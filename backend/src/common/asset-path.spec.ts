import { describe, expect, it } from 'vitest';
import { validate } from 'class-validator';
import { UpdateRoomTypeDto } from '../modules/room-types/dto/write-room-type.dto.js';
import { UpdateServiceDto } from '../modules/services/dto/write-service.dto.js';

describe('image DTO validation', () => {
  it('accepts storage-relative image paths', async () => {
    const dto = Object.assign(new UpdateRoomTypeDto(), {
      images: ['/images/seeds/room-types/standard-01.jpg'],
    });
    expect(await validate(dto)).toEqual([]);
  });

  it('rejects external URLs and galleries with more than ten images', async () => {
    const service = Object.assign(new UpdateServiceDto(), {
      imageUrl: 'https://example.com/a.jpg',
    });
    expect((await validate(service)).map((error) => error.property)).toContain(
      'imageUrl',
    );
    const room = Object.assign(new UpdateRoomTypeDto(), {
      images: Array(11).fill('/images/seeds/room-types/standard-01.jpg'),
    });
    expect((await validate(room)).map((error) => error.property)).toContain(
      'images',
    );
  });
});
