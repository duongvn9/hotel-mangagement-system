import { describe, expect, it } from 'vitest';
import { BookingStatus } from './schemas/booking.schema.js';
import { sampleBookings } from './seed.js';

describe('sampleBookings', () => {
  it('provides a confirmed single-room stay starting on the seed business day', () => {
    const samples = sampleBookings('2026-11-07');
    expect(
      samples.find((sample) => sample.code === 'SEED-CONFIRMED-001'),
    ).toEqual({
      code: 'SEED-CONFIRMED-001',
      roomNumber: '102',
      checkInDay: '2026-11-07',
      nights: 2,
      status: BookingStatus.Confirmed,
    });
  });
});
