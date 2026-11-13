import { ConfigService } from '@nestjs/config';
import { CheckInEvidenceStorage } from './check-in-evidence.storage.js';

const mocks = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: class {
    send = mocks.send;
    destroy() {}
  },
  PutObjectCommand: class {
    constructor(public input: unknown) {}
  },
  GetObjectCommand: class {
    constructor(public input: unknown) {}
  },
  DeleteObjectCommand: class {
    constructor(public input: unknown) {}
  },
}));

const config = (values: Record<string, string> = {}) =>
  new ConfigService({
    S3_ENDPOINT: 'https://storage.example.com',
    S3_BUCKET: 'test',
    S3_ACCESS_KEY_ID: 'test',
    S3_SECRET_ACCESS_KEY: 'test',
    ...values,
  });
const jpeg = {
  buffer: Buffer.from([255, 216, 255, 0]),
  mimetype: 'image/jpeg',
  size: 4,
};

describe('CheckInEvidenceStorage', () => {
  const sut = new CheckInEvidenceStorage(config());
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.send.mockResolvedValue({});
  });

  it('stores the photo under a private prefix that is not served as a public image', async () => {
    const key = await sut.put(jpeg);

    expect(key).toMatch(/^private\/check-ins\/[0-9a-f-]{36}\.jpg$/);
    expect(key.startsWith('images/')).toBe(false);
    expect(mocks.send.mock.calls[0][0].input).toMatchObject({
      Bucket: 'test',
      Key: key,
      Body: jpeg.buffer,
      ContentType: 'image/jpeg',
    });
  });

  it('rejects a missing or disguised file without touching storage', async () => {
    await expect(sut.put(undefined)).rejects.toThrow('5 MB');
    await expect(
      sut.put({ ...jpeg, buffer: Buffer.from('not an image') }),
    ).rejects.toThrow('JPG');
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it('reports storage as unavailable when it is not configured', async () => {
    const unconfigured = new CheckInEvidenceStorage(config({ S3_BUCKET: '' }));

    await expect(unconfigured.put(jpeg)).rejects.toThrow('storage');
  });

  it('maps an S3 failure to 503 without leaking details', async () => {
    mocks.send.mockRejectedValueOnce(new Error('AccessDenied secret-detail'));

    await expect(sut.put(jpeg)).rejects.toThrow(
      'Không lưu được ảnh vào storage',
    );
  });

  it('reads the photo back with a content type derived from the key, not from S3', async () => {
    mocks.send.mockResolvedValueOnce({
      ContentType: 'text/html',
      Body: { transformToByteArray: async () => Uint8Array.from([1, 2, 3]) },
    });

    const result = await sut.get(
      'private/check-ins/123e4567-e89b-12d3-a456-426614174000.png',
    );

    expect(result.contentType).toBe('image/png');
    expect([...result.body]).toEqual([1, 2, 3]);
  });

  it('refuses to read keys outside the private check-ins prefix', async () => {
    await expect(sut.get('images/seeds/room-types/a.jpg')).rejects.toThrow();
    await expect(
      sut.get('private/check-ins/../../secret.jpg'),
    ).rejects.toThrow();
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it('removes a stored photo and swallows delete failures', async () => {
    const key = 'private/check-ins/123e4567-e89b-12d3-a456-426614174000.jpg';
    await sut.remove(key);
    expect(mocks.send.mock.calls[0][0].input).toMatchObject({
      Bucket: 'test',
      Key: key,
    });

    mocks.send.mockRejectedValueOnce(new Error('down'));
    await expect(sut.remove(key)).resolves.toBeUndefined();
  });

  describe('putAll', () => {
    it('stores every photo under its own private key and returns them in order', async () => {
      const keys = await sut.putAll([jpeg, jpeg]);

      expect(keys).toHaveLength(2);
      expect(new Set(keys).size).toBe(2);
      for (const key of keys) {
        expect(key).toMatch(/^private\/check-ins\/[0-9a-f-]{36}\.jpg$/);
      }
      expect(mocks.send).toHaveBeenCalledTimes(2);
    });

    it('validates every file before uploading any of them', async () => {
      await expect(
        sut.putAll([jpeg, { ...jpeg, buffer: Buffer.from('not an image') }]),
      ).rejects.toThrow('JPG');
      expect(mocks.send).not.toHaveBeenCalled();
    });

    it('deletes the photos already stored when a later upload fails', async () => {
      mocks.send
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(new Error('down'))
        .mockResolvedValue({});

      await expect(sut.putAll([jpeg, jpeg])).rejects.toThrow(
        'Không lưu được ảnh vào storage',
      );

      const stored = mocks.send.mock.calls[0][0].input.Key as string;
      const deleted = mocks.send.mock.calls
        .slice(2)
        .map(([command]) => command.input.Key);
      expect(deleted).toEqual([stored]);
    });
  });
});
