import { Types, type Model } from 'mongoose';
import { vi } from 'vitest';
import {
  BookingSource,
  BookingStatus,
  Booking,
} from './schemas/booking.schema.js';
import { RoomHold } from './schemas/room-hold.schema.js';
import { Room } from '../rooms/schemas/room.schema.js';
import {
  PaymentTransaction,
  PaymentPurpose,
  PaymentStatus,
} from '../payments/schemas/payment-transaction.schema.js';
import { AvailabilityClock } from './availability.adapters.js';
import { BookingsService } from './bookings.service.js';
import { toBookingListItem } from './booking-list-item.js';
import { UpdateBookingDto } from './dto/create-booking.dto.js';
import { validate } from 'class-validator';

const now = new Date('2026-10-28T00:00:00Z');
const setup = (live = true, paymentPending = false) => {
  const booking = {
    _id: new Types.ObjectId(),
    code: 'BKTEST',
    isActive: true,
    status: BookingStatus.PendingDeposit,
    adultCount: 2,
    childCount: 1,
    source: BookingSource.Online,
    rooms: [new Types.ObjectId()],
    checkIn: new Date('2094-01-10T00:00:00Z'),
    checkOut: new Date('2094-01-12T00:00:00Z'),
    save: vi.fn(),
  };
  const hold = { expiresAt: new Date(now.getTime() + 60000) };
  const bookings = { findById: vi.fn().mockResolvedValue(booking) };
  const holds = { findOne: vi.fn().mockResolvedValue(live ? hold : null) };
  const payments = {
    exists: vi.fn().mockResolvedValue(paymentPending ? {} : null),
  };
  const service = new BookingsService(
    bookings as unknown as Model<Booking>,
    holds as unknown as Model<RoomHold>,
    {} as Model<Room>,
    { now: () => now } as AvailabilityClock,
    payments as unknown as Model<PaymentTransaction>,
  );
  return { service, booking, bookings, holds, payments, hold };
};

describe('booking merge integration', () => {
  it('keeps update occupancy optional without defaulting childCount', async () => {
    const dto = new UpdateBookingDto();
    expect(dto.childCount).toBeUndefined();
    expect(
      await validate(Object.assign(dto, { adultCount: 1, childCount: 0 })),
    ).toEqual([]);
    expect(
      await validate(
        Object.assign(new UpdateBookingDto(), {
          adultCount: 0,
          childCount: -1,
        }),
      ),
    ).toHaveLength(2);
  });

  it('maps canonical occupancy, source and absent contacts for a held booking', () => {
    const row = toBookingListItem({
      _id: new Types.ObjectId(),
      code: 'HELD',
      status: BookingStatus.RoomHeld,
      adultCount: 2,
      childCount: 1,
      source: BookingSource.Online,
      rooms: [],
      checkIn: now,
      checkOut: new Date(now.getTime() + 86400000),
      roomTotal: 100,
    });
    expect(row).toMatchObject({
      adultCount: 2,
      childCount: 1,
      source: BookingSource.Online,
    });
    expect(row.guestName).toBeUndefined();
    expect(row).not.toHaveProperty('guests');
  });

  it('rejects even contact edits without a live pending hold', async () => {
    const { service, booking } = setup(false);
    await expect(
      service.update(String(booking._id), { guestName: 'Updated' }),
    ).rejects.toThrow('Hold has expired');
    expect(booking.status).toBe(BookingStatus.Expired);
  });

  it('rejects stay edits while a deposit is pending in the existing payment model', async () => {
    const { service, booking, payments } = setup(true, true);
    await expect(
      service.update(String(booking._id), { childCount: 0 }),
    ).rejects.toThrow('deposit payment is pending');
    expect(payments.exists).toHaveBeenCalledWith({
      booking: booking._id,
      purpose: PaymentPurpose.Deposit,
      status: PaymentStatus.Pending,
      isActive: true,
    });
    expect(booking.save).not.toHaveBeenCalled();
  });

  it('allows contact edits during payment without extending the hold', async () => {
    const { service, booking, hold, payments, holds } = setup(true, true);
    const deadline = hold.expiresAt.getTime();
    await service.update(String(booking._id), { guestName: ' Updated ' });
    expect(booking.save).toHaveBeenCalledOnce();
    expect(payments.exists).not.toHaveBeenCalled();
    expect(holds.findOne).toHaveBeenCalledWith({
      booking: booking._id,
      isActive: true,
      expiresAt: { $gt: now },
    });
    expect(hold.expiresAt.getTime()).toBe(deadline);
  });
});
