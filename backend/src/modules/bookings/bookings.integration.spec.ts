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
const setup = (
  live = true,
  paymentPending = false,
  invoice: unknown = null,
) => {
  const booking = {
    _id: new Types.ObjectId(),
    code: 'BKTEST',
    isActive: true,
    status: BookingStatus.PendingDeposit,
    adultCount: 2,
    childCount: 1,
    source: BookingSource.Online,
    rooms: [new Types.ObjectId()],
    roomTotal: 1_000_000,
    depositAmount: 100_000,
    guestName: 'Khách Test',
    guestEmail: 'guest@example.com',
    checkIn: new Date('2094-01-10T00:00:00Z'),
    checkOut: new Date('2094-01-12T00:00:00Z'),
    save: vi.fn(),
  };
  const hold = { expiresAt: new Date(now.getTime() + 60000) };
  const bookings = {
    findById: vi.fn().mockResolvedValue(booking),
    updateOne: vi.fn().mockResolvedValue({ modifiedCount: 1 }),
    exists: vi.fn().mockResolvedValue({ _id: booking._id }),
  };
  // findOne dùng được cả hai cách: `await findOne()` (update) và `findOne().sort()` (getBooking).
  const heldValue = live ? hold : null;
  const holdQuery = Object.assign(Promise.resolve(heldValue), {
    sort: vi.fn().mockResolvedValue(heldValue),
  });
  const holds = {
    findOne: vi.fn().mockReturnValue(holdQuery),
    updateMany: vi.fn().mockResolvedValue({ modifiedCount: 1 }),
  };
  const payments = {
    exists: vi.fn().mockResolvedValue(paymentPending ? {} : null),
    updateMany: vi.fn().mockResolvedValue({ modifiedCount: 1 }),
  };
  const invoices = {
    findOne: vi.fn().mockReturnValue({
      lean: vi.fn().mockResolvedValue(invoice),
    }),
  };
  const notifications = { send: vi.fn().mockResolvedValue({ accepted: true }) };
  const service = new BookingsService(
    bookings as unknown as Model<Booking>,
    holds as unknown as Model<RoomHold>,
    {} as Model<Room>,
    { now: () => now } as AvailabilityClock,
    payments as unknown as Model<PaymentTransaction>,
    invoices as never,
    notifications as never,
    {} as never,
  );
  return {
    service,
    booking,
    bookings,
    holds,
    payments,
    invoices,
    notifications,
    hold,
  };
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
    ).rejects.toThrow('hết hạn');
    expect(booking.status).toBe(BookingStatus.Expired);
  });

  it('rejects stay edits while a deposit is pending in the existing payment model', async () => {
    const { service, booking, payments } = setup(true, true);
    await expect(
      service.update(String(booking._id), { childCount: 0 }),
    ).rejects.toThrow('đặt cọc chờ xử lý');
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

  it('reports an unpaid summary when the booking has no invoice yet', async () => {
    const { service, booking } = setup(true, false, null);
    const result = await service.getBooking(String(booking._id), {
      code: 'BKTEST',
    });
    expect(result).toMatchObject({
      serviceTotal: 0,
      paidAmount: 0,
      balanceDue: booking.roomTotal,
      invoiceStatus: 'UNPAID',
    });
  });

  it('summarises services, amount paid and balance from the invoice', async () => {
    const { service, booking } = setup(true, false, {
      serviceTotal: 200_000,
      depositPaid: 100_000,
      finalPaid: 300_000,
      balanceDue: 800_000,
      status: 'PARTIALLY_PAID',
    });
    const result = await service.getBooking(String(booking._id), {
      code: 'BKTEST',
    });
    expect(result).toMatchObject({
      serviceTotal: 200_000,
      paidAmount: 400_000,
      balanceDue: 800_000,
      invoiceStatus: 'PARTIALLY_PAID',
    });
  });

  it('on cancel flags paid transactions for reconciliation and emails the guest', async () => {
    const { service, booking, payments, notifications } = setup(true);
    const result = await service.cancel(String(booking._id), {
      code: 'BKTEST',
    });

    expect(result.status).toBe('CANCELLED');
    expect(payments.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        booking: booking._id,
        status: PaymentStatus.Success,
        isActive: true,
      }),
      { $set: { needsReconciliation: true } },
    );
    expect(notifications.send).toHaveBeenCalledWith(
      expect.objectContaining({
        template: 'BOOKING_CANCELLATION',
        to: 'guest@example.com',
      }),
    );
  });
});

describe('updateHoldRooms', () => {
  const now = new Date('2026-10-28T00:00:00Z');
  // find().select().lean().exec() và find().populate().lean().exec() đều trả `value`.
  const chain = (value: unknown) => ({
    select: () => ({ lean: () => ({ exec: () => Promise.resolve(value) }) }),
    populate: () => ({ lean: () => ({ exec: () => Promise.resolve(value) }) }),
  });

  const build = (
    opts: { hold?: unknown; booking?: unknown; roomRows?: unknown[] } = {},
  ) => {
    const bookingId = new Types.ObjectId();
    const typeId = new Types.ObjectId();
    const roomA = new Types.ObjectId();
    const roomB = new Types.ObjectId();
    const booking =
      opts.booking === undefined
        ? {
            _id: bookingId,
            code: 'BKUPD',
            isActive: true,
            status: BookingStatus.RoomHeld,
            checkIn: new Date('2094-01-10T00:00:00Z'),
            checkOut: new Date('2094-01-12T00:00:00Z'),
            adultCount: 2,
            childCount: 0,
            rooms: [roomA],
            roomTotal: 1_000_000,
            depositAmount: 100_000,
            rateSnapshot: [],
            save: vi.fn(),
          }
        : opts.booking;
    const hold =
      opts.hold === undefined
        ? {
            _id: new Types.ObjectId(),
            booking: bookingId,
            holdToken: 'HOLDTOKEN_UPDATE_1',
            isActive: true,
            expiresAt: new Date(now.getTime() + 60_000),
            rooms: [roomA],
            checkIn: new Date('2094-01-10T00:00:00Z'),
            checkOut: new Date('2094-01-12T00:00:00Z'),
            save: vi.fn(),
          }
        : opts.hold;
    const roomRows =
      opts.roomRows ??
      [roomA, roomB].map((id) => ({
        _id: id,
        isActive: true,
        status: 'AVAILABLE',
        roomType: {
          _id: typeId,
          name: 'Deluxe',
          basePrice: 1_000_000,
          adultCapacity: 2,
          childCapacity: 1,
          isActive: true,
        },
      }));
    const holds = {
      findOne: vi.fn().mockResolvedValue(hold),
      find: vi.fn().mockReturnValue(chain([])),
    };
    const bookings = {
      findById: vi.fn().mockResolvedValue(booking),
      find: vi.fn().mockReturnValue(chain([])),
    };
    const rooms = { find: vi.fn().mockReturnValue(chain(roomRows)) };
    const service = new BookingsService(
      bookings as unknown as Model<Booking>,
      holds as unknown as Model<RoomHold>,
      rooms as unknown as Model<Room>,
      { now: () => now } as AvailabilityClock,
      {} as Model<PaymentTransaction>,
      {} as never,
      { send: vi.fn() } as never,
      {} as never,
    );
    return { service, booking, hold, roomA, roomB };
  };

  it('re-prices and saves the new rooms in place (no new hold)', async () => {
    const { service, booking, hold, roomA, roomB } = build() as {
      service: BookingsService;
      booking: {
        save: ReturnType<typeof vi.fn>;
        rooms: unknown[];
        roomTotal: number;
        depositAmount: number;
      };
      hold: { save: ReturnType<typeof vi.fn> };
      roomA: Types.ObjectId;
      roomB: Types.ObjectId;
    };
    const result = await service.updateHoldRooms({
      holdToken: 'HOLDTOKEN_UPDATE_1',
      rooms: [String(roomA), String(roomB)],
    });
    expect(hold.save).toHaveBeenCalled();
    expect(booking.save).toHaveBeenCalled();
    expect(booking.rooms).toHaveLength(2);
    expect(booking.roomTotal).toBe(4_000_000); // 2 phòng × 1tr × 2 đêm
    expect(booking.depositAmount).toBe(400_000);
    expect(result.rooms).toEqual([String(roomA), String(roomB)]);
    expect(result.roomTypes[0].roomIds).toHaveLength(2);
  });

  it('rejects a duplicate room in the request', async () => {
    const { service, roomA } = build();
    await expect(
      service.updateHoldRooms({
        holdToken: 'HOLDTOKEN_UPDATE_1',
        rooms: [String(roomA), String(roomA)],
      }),
    ).rejects.toThrow('trùng');
  });

  it('rejects when the hold is no longer active', async () => {
    const { service } = build({ hold: null });
    await expect(
      service.updateHoldRooms({
        holdToken: 'HOLDTOKEN_UPDATE_1',
        rooms: [String(new Types.ObjectId())],
      }),
    ).rejects.toThrow('Không tìm thấy phiên giữ phòng');
  });

  it('expires and rejects when the hold window has passed', async () => {
    const booking = {
      _id: new Types.ObjectId(),
      isActive: true,
      status: BookingStatus.RoomHeld,
      save: vi.fn(),
    };
    const hold = {
      _id: new Types.ObjectId(),
      booking: booking._id,
      isActive: true,
      expiresAt: new Date(now.getTime() - 1_000),
      save: vi.fn(),
    };
    const { service } = build({ hold, booking });
    await expect(
      service.updateHoldRooms({
        holdToken: 'HOLDTOKEN_UPDATE_1',
        rooms: [String(new Types.ObjectId())],
      }),
    ).rejects.toThrow('hết hạn');
    expect(booking.status).toBe(BookingStatus.Expired);
  });

  it('rejects editing once the booking has left ROOM_HELD', async () => {
    const booking = {
      _id: new Types.ObjectId(),
      isActive: true,
      status: BookingStatus.PendingDeposit,
      save: vi.fn(),
    };
    const hold = {
      _id: new Types.ObjectId(),
      booking: booking._id,
      isActive: true,
      expiresAt: new Date(now.getTime() + 60_000),
      save: vi.fn(),
    };
    const { service } = build({ hold, booking });
    await expect(
      service.updateHoldRooms({
        holdToken: 'HOLDTOKEN_UPDATE_1',
        rooms: [String(new Types.ObjectId())],
      }),
    ).rejects.toThrow('không ở bước chọn phòng');
  });
});

describe('resolveByCode', () => {
  const makeService = (found: unknown) => {
    const bookings = {
      findOne: vi
        .fn()
        .mockReturnValue({ select: vi.fn().mockResolvedValue(found) }),
    };
    const service = new BookingsService(
      bookings as unknown as Model<Booking>,
      {} as Model<RoomHold>,
      {} as Model<Room>,
      { now: () => new Date() } as AvailabilityClock,
      {} as Model<PaymentTransaction>,
      {} as never,
      {} as never,
      {} as never,
    );
    return { service, bookings };
  };

  it('returns the id for an existing code (trimmed and uppercased)', async () => {
    const id = new Types.ObjectId();
    const { service, bookings } = makeService({ _id: id });
    expect(await service.resolveByCode('  bk456  ')).toEqual({
      id: String(id),
    });
    expect(bookings.findOne).toHaveBeenCalledWith({
      code: 'BK456',
      isActive: true,
    });
  });

  it('rejects a malformed code before querying', async () => {
    const { service, bookings } = makeService({ _id: new Types.ObjectId() });
    await expect(service.resolveByCode('!!')).rejects.toThrow(
      'Mã booking không hợp lệ',
    );
    expect(bookings.findOne).not.toHaveBeenCalled();
  });

  it('throws when no booking matches the code', async () => {
    const { service } = makeService(null);
    await expect(service.resolveByCode('BKZZZ9')).rejects.toThrow(
      'Không tìm thấy',
    );
  });
});
