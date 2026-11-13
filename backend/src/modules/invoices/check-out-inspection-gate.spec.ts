import { ConflictException } from '@nestjs/common';
import { Types } from 'mongoose';
import { RoomStatus } from '../../common/constants/room-status.enum.js';
import { BookingStatus } from '../bookings/schemas/booking.schema.js';
import { TaskSourceType, TaskStatus } from '../tasks/task-contract.js';
import { CheckOutService } from './check-out.service.js';

const roomId = new Types.ObjectId();
const bookingId = new Types.ObjectId();

const chain = <T>(result: T) => {
  const query: Record<string, unknown> = {};
  for (const name of ['select', 'lean']) query[name] = () => query;
  query.exec = async () => result;
  return query;
};

const invoice = {
  roomTotal: 1_700_000,
  serviceTotal: 0,
  additionalTotal: 0,
  discountTotal: 0,
  taxTotal: 0,
  totalAmount: 1_700_000,
  depositPaid: 170_000,
  finalPaid: 1_530_000,
  balanceDue: 0,
  status: 'PAID',
  charges: [],
};

function setup(
  options: {
    inspection?: { status: TaskStatus } | null;
    checkedOut?: boolean;
  } = {},
) {
  const checkedOutAt = new Date('2026-11-11T05:00:00Z');
  const booking = {
    _id: bookingId,
    code: 'GE-123',
    guestName: 'Alice',
    guestEmail: 'alice@example.com',
    isActive: true,
    status: options.checkedOut
      ? BookingStatus.CheckedOut
      : BookingStatus.CheckedIn,
    checkedOutAt: options.checkedOut ? checkedOutAt : undefined,
    checkoutRoomProjectionCompletedAt: options.checkedOut
      ? new Date()
      : undefined,
    rooms: [roomId],
    acceptanceReservations: [],
  };
  const bookings = {
    findById: vi.fn(async () => booking),
    updateOne: vi.fn(async () => ({ modifiedCount: 1 })),
    exists: vi.fn(async () => ({ _id: bookingId })),
    findOneAndUpdate: vi.fn(() => chain(booking)),
    db: { collection: () => ({ findOne: vi.fn(async () => null) }) },
  };
  const rooms = { updateMany: vi.fn(), find: vi.fn(() => chain([])) };
  const payments = { exists: vi.fn(async () => null) };
  const invoices = {
    recalculate: vi.fn(async () => invoice),
    getOrCreateForBooking: vi.fn(async () => invoice),
  };
  const tasks = {
    latestForSource: vi.fn(async () =>
      options.inspection === undefined
        ? { status: TaskStatus.Completed }
        : options.inspection,
    ),
  };
  const sut = new CheckOutService(
    bookings as never,
    rooms as never,
    payments as never,
    invoices as never,
    { send: vi.fn(async () => ({ accepted: true })) } as never,
    tasks as never,
  );
  return { sut, bookings, tasks, rooms };
}

describe('CheckOutService inspection gate', () => {
  it('checks the guest out once service staff has completed the room inspection', async () => {
    const { sut, bookings, tasks, rooms } = setup({
      inspection: { status: TaskStatus.Completed },
    });

    await expect(sut.checkOut(bookingId.toHexString())).resolves.toBeDefined();

    expect(tasks.latestForSource).toHaveBeenCalledWith(
      TaskSourceType.CheckoutInspection,
      bookingId.toHexString(),
    );
    expect(bookings.findOneAndUpdate).toHaveBeenCalled();
    expect(rooms.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        status: { $in: [RoomStatus.Occupied, RoomStatus.Cleaning] },
      }),
      { $set: { status: RoomStatus.Available } },
    );
  });

  it('refuses when no inspection was ever requested', async () => {
    const { sut, bookings } = setup({ inspection: null });

    const result = sut.checkOut(bookingId.toHexString());

    await expect(result).rejects.toBeInstanceOf(ConflictException);
    await expect(result).rejects.toThrow(/not been inspected/i);
    expect(bookings.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it.each([TaskStatus.Assigned, TaskStatus.InProgress])(
    'refuses while the inspection is still %s',
    async (status) => {
      const { sut, bookings } = setup({ inspection: { status } });

      const result = sut.checkOut(bookingId.toHexString());

      await expect(result).rejects.toBeInstanceOf(ConflictException);
      await expect(result).rejects.toThrow(/has not confirmed/i);
      expect(bookings.findOneAndUpdate).not.toHaveBeenCalled();
    },
  );

  it('refuses when the latest inspection was cancelled', async () => {
    const { sut } = setup({ inspection: { status: TaskStatus.Cancelled } });

    await expect(sut.checkOut(bookingId.toHexString())).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('does not ask again for a guest who is already checked out (replay)', async () => {
    const { sut, tasks } = setup({ checkedOut: true, inspection: null });

    await expect(sut.checkOut(bookingId.toHexString())).resolves.toBeDefined();

    expect(tasks.latestForSource).not.toHaveBeenCalled();
  });
});
