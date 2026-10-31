import { ConfigService } from '@nestjs/config';
import { RoomTypeImagesService } from './room-type-images.service.js';

const mocks = vi.hoisted(() => ({
  send: vi.fn(),
  mkdir: vi.fn(),
  writeFile: vi.fn(),
  unlink: vi.fn(),
}));
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: class {
    send = mocks.send;
    destroy() {}
  },
  PutObjectCommand: class {
    constructor(public input: unknown) {}
  },
}));
vi.mock('node:fs/promises', () => ({
  mkdir: mocks.mkdir,
  writeFile: mocks.writeFile,
  unlink: mocks.unlink,
}));

describe('Room type images dual storage', () => {
  const service = new RoomTypeImagesService(
    new ConfigService({
      S3_ENDPOINT: 'https://storage.example.com',
      S3_BUCKET: 'test',
      S3_ACCESS_KEY_ID: 'test',
      S3_SECRET_ACCESS_KEY: 'test',
    }),
  );
  const file = {
    buffer: Buffer.from([255, 216, 255, 0]),
    mimetype: 'image/jpeg',
    size: 4,
  };
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.send.mockResolvedValue({});
    mocks.writeFile.mockResolvedValue(undefined);
    mocks.unlink.mockResolvedValue(undefined);
  });
  it('rejects disguised files before writing either copy', async () => {
    await expect(
      service.upload({ ...file, buffer: Buffer.from('invalid') }),
    ).rejects.toThrow('JPG');
    expect(mocks.writeFile).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it('saves matching filenames locally and on S3', async () => {
    const result = await service.upload(file);
    const filename = result.path.split('/').pop()!;
    expect(mocks.writeFile.mock.calls[0][0]).toContain(filename);
    expect(mocks.send.mock.calls[0][0].input).toMatchObject({
      Key: result.path.slice(1),
      Body: file.buffer,
    });
  });
  it('removes the local copy and reports failure when S3 rejects upload', async () => {
    mocks.send.mockRejectedValueOnce(new Error('denied'));
    await expect(service.upload(file)).rejects.toThrow('Không lưu được ảnh');
    expect(mocks.unlink).toHaveBeenCalledWith(mocks.writeFile.mock.calls[0][0]);
  });
});
