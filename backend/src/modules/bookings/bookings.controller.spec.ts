import { StreamableFile } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { BookingsController } from './bookings.controller.js';
import { CheckInDto } from './dto/check-in.dto.js';

const photo = { buffer: Buffer.from('x'), mimetype: 'image/jpeg', size: 1 };

describe('BookingsController check-in evidence', () => {
  it('passes the uploaded ID photos to the check-in service', async () => {
    const checkIns = { checkIn: vi.fn(async () => ({ id: 'b1' })) };
    const sut = new BookingsController(
      {} as never,
      checkIns as never,
      {} as never,
    );
    const dto = new CheckInDto();

    await sut.checkIn('b1', dto, [photo, photo]);

    expect(checkIns.checkIn).toHaveBeenCalledWith('b1', dto, [photo, photo]);
  });

  it('reports how many photos a booking has', async () => {
    const checkIns = { evidenceCount: vi.fn(async () => ({ count: 3 })) };
    const sut = new BookingsController(
      {} as never,
      checkIns as never,
      {} as never,
    );

    await expect(sut.checkInEvidenceCount('b1')).resolves.toEqual({
      count: 3,
    });
  });

  it('streams one stored photo with private, non-sniffable headers', async () => {
    const checkIns = {
      evidencePhoto: vi.fn(async () => ({
        body: Uint8Array.from([1, 2]),
        contentType: 'image/png',
      })),
    };
    const sut = new BookingsController(
      {} as never,
      checkIns as never,
      {} as never,
    );
    const res = { set: vi.fn() };

    const result = await sut.checkInEvidencePhoto('b1', 1, res as never);

    expect(checkIns.evidencePhoto).toHaveBeenCalledWith('b1', 1);
    expect(result).toBeInstanceOf(StreamableFile);
    expect(result.getHeaders().type).toBe('image/png');
    expect(res.set).toHaveBeenCalledWith({
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    });
  });
});

describe('CheckInDto (multipart)', () => {
  const room = '507f1f77bcf86cd799439011';
  const other = '507f1f77bcf86cd799439012';
  const parse = (body: Record<string, unknown>) =>
    plainToInstance(CheckInDto, body);

  it('accepts replacements sent as a JSON string next to the file', async () => {
    const dto = parse({
      replacements: JSON.stringify([{ from: room, to: other }]),
    });

    expect(dto.replacements).toEqual([{ from: room, to: other }]);
    expect(await validate(dto)).toEqual([]);
  });

  it('still accepts a plain JSON body and an empty body', async () => {
    expect(
      await validate(parse({ replacements: [{ from: room, to: other }] })),
    ).toEqual([]);
    expect(await validate(parse({}))).toEqual([]);
  });

  it('rejects malformed JSON instead of ignoring it', async () => {
    expect(await validate(parse({ replacements: '{not json' }))).not.toEqual(
      [],
    );
  });
});
