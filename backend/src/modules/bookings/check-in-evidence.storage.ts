import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { randomUUID } from 'node:crypto';
import {
  validateImage,
  type AssetImageFile,
} from '../../common/asset-images.service.js';

/** ID photos live outside the public `images/` prefix and are only readable through the authorised API. */
const KEY_PATTERN =
  /^private\/check-ins\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/;
const CONTENT_TYPES = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
} as const;

/** Stores guest ID photos in private S3: no copy on disk and no public URL. */
@Injectable()
export class CheckInEvidenceStorage {
  private readonly logger = new Logger(CheckInEvidenceStorage.name);
  constructor(private readonly config: ConfigService) {}

  /** Stores the photo and returns the S3 key to record on the booking. */
  async put(file?: AssetImageFile): Promise<string> {
    const { file: image, extension } = validateImage(file);
    const key = `private/check-ins/${randomUUID()}.${extension}`;
    await this.withClient(async (client, bucket) => {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: image.buffer,
          ContentType: image.mimetype,
        }),
      );
    }, 'Không lưu được ảnh vào storage. Vui lòng thử lại.');
    return key;
  }

  /**
   * Stores several photos as one unit: all files are validated before the first upload, and if an
   * upload fails the ones already stored are deleted, so a failed call leaves nothing behind.
   */
  async putAll(files: AssetImageFile[]): Promise<string[]> {
    for (const file of files) validateImage(file);
    const keys: string[] = [];
    try {
      for (const file of files) keys.push(await this.put(file));
    } catch (error) {
      await this.removeAll(keys);
      throw error;
    }
    return keys;
  }

  /** Reads the photo; the content type comes from the server-generated key extension, not from S3. */
  async get(key: string): Promise<{ body: Uint8Array; contentType: string }> {
    if (!KEY_PATTERN.test(key)) {
      throw new BadRequestException('Invalid evidence key');
    }
    const extension = key.slice(
      key.lastIndexOf('.') + 1,
    ) as keyof typeof CONTENT_TYPES;
    const body = await this.withClient(async (client, bucket) => {
      const result = await client.send(
        new GetObjectCommand({ Bucket: bucket, Key: key }),
      );
      return result.Body!.transformToByteArray();
    }, 'Không đọc được ảnh giấy tờ. Vui lòng thử lại.');
    return { body, contentType: CONTENT_TYPES[extension] };
  }

  /** Deletes an orphaned photo when the check-in did not complete; delete failures are only logged. */
  async remove(key: string): Promise<void> {
    if (!KEY_PATTERN.test(key)) return;
    try {
      await this.withClient(async (client, bucket) => {
        await client.send(
          new DeleteObjectCommand({ Bucket: bucket, Key: key }),
        );
      }, '');
    } catch {
      this.logger.warn('Could not remove check-in evidence.');
    }
  }

  async removeAll(keys: string[]): Promise<void> {
    await Promise.all(keys.map((key) => this.remove(key)));
  }

  private async withClient<T>(
    run: (client: S3Client, bucket: string) => Promise<T>,
    failure: string,
  ): Promise<T> {
    const accessKeyId = this.config.get<string>('S3_ACCESS_KEY_ID');
    const secretAccessKey = this.config.get<string>('S3_SECRET_ACCESS_KEY');
    const endpoint = this.config.get<string>('S3_ENDPOINT');
    const bucket = this.config.get<string>('S3_BUCKET');
    if (!accessKeyId || !secretAccessKey || !endpoint || !bucket) {
      throw new ServiceUnavailableException('Chưa cấu hình storage ảnh.');
    }
    const client = new S3Client({
      endpoint,
      region: this.config.get<string>('S3_REGION') || 'us-east-1',
      forcePathStyle: true,
      credentials: { accessKeyId, secretAccessKey },
      requestHandler: { connectionTimeout: 5000, requestTimeout: 30000 },
    });
    try {
      return await run(client, bucket);
    } catch {
      this.logger.error('Check-in evidence storage failed.');
      throw new ServiceUnavailableException(failure);
    } finally {
      client.destroy();
    }
  }
}
