import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export interface AssetImageFile {
  buffer: Buffer;
  mimetype: string;
  size: number;
}

@Injectable()
export class AssetImagesService {
  private readonly logger = new Logger(AssetImagesService.name);
  constructor(private readonly config: ConfigService) {}

  async upload(
    file?: AssetImageFile,
    group: 'room-types' | 'amenities' = 'room-types',
  ) {
    if (!file || !file.size || file.size > 5 * 1024 * 1024) {
      throw new BadRequestException('Chọn ảnh tối đa 5 MB.');
    }
    const bytes = file.buffer;
    const extension =
      file.mimetype === 'image/jpeg' &&
      bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255]))
        ? 'jpg'
        : file.mimetype === 'image/png' &&
            bytes
              .subarray(0, 8)
              .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
          ? 'png'
          : file.mimetype === 'image/webp' &&
              bytes.toString('ascii', 0, 4) === 'RIFF' &&
              bytes.toString('ascii', 8, 12) === 'WEBP'
            ? 'webp'
            : undefined;
    if (!extension)
      throw new BadRequestException(
        'Chỉ chấp nhận ảnh JPG, PNG hoặc WebP hợp lệ.',
      );
    const accessKeyId = this.config.get<string>('S3_ACCESS_KEY_ID');
    const secretAccessKey = this.config.get<string>('S3_SECRET_ACCESS_KEY');
    const endpoint = this.config.get<string>('S3_ENDPOINT');
    const bucket = this.config.get<string>('S3_BUCKET');
    if (!accessKeyId || !secretAccessKey || !endpoint || !bucket) {
      throw new ServiceUnavailableException('Chưa cấu hình storage ảnh.');
    }
    const filename = `${randomUUID()}.${extension}`;
    const directory = resolve(
      this.config.get<string>('HMS_ASSET_DIR') || '../hms',
      group,
    );
    const localPath = resolve(directory, filename);
    const path = `/images/seeds/${group}/${filename}`;
    const client = new S3Client({
      endpoint,
      region: this.config.get<string>('S3_REGION') || 'us-east-1',
      forcePathStyle: true,
      credentials: { accessKeyId, secretAccessKey },
      requestHandler: { connectionTimeout: 5000, requestTimeout: 30000 },
    });
    let localWritten = false;
    try {
      await mkdir(directory, { recursive: true });
      await writeFile(localPath, bytes, { flag: 'wx' });
      localWritten = true;
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: path.slice(1),
          Body: bytes,
          ContentType: file.mimetype,
        }),
      );
      return { path };
    } catch {
      if (localWritten)
        await unlink(localPath).catch(() =>
          this.logger.warn('Could not remove incomplete local image.'),
        );
      this.logger.error('Asset image upload failed.');
      throw new ServiceUnavailableException(
        'Không lưu được ảnh vào storage. Vui lòng thử lại.',
      );
    } finally {
      client.destroy();
    }
  }
}
