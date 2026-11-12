import { Types } from 'mongoose';
import { BookingStatus } from '../bookings/schemas/booking.schema.js';
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
  serviceTotal: 150_000,
  additionalTotal: 50_000,
  discountTotal: 0,
  taxTotal: 0,
  totalAmount: 1_900_000,
  depositPaid: 170_000,
  finalPaid: 1_730_000,
  balanceDue: 0,
  status: 'PAID',
  charges: [],
};

function setup(options: { alreadyCheckedOut?: boolean } = {}) {
  const checkedOutAt = new Date('2026-11-11T05:00:00Z');
  const booking = {
    _id: bookingId,
    code: 'GE-123',
    guestName: 'Alice',
    guestEmail: 'alice@example.com',
    isActive: true,
    status: options.alreadyCheckedOut
      ? BookingStatus.CheckedOut
      : BookingStatus.CheckedIn,
    checkedOutAt: options.alreadyCheckedOut ? checkedOutAt : undefined,
    checkoutRoomProjectionCompletedAt: new Date(),
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
  const rooms = {
    updateMany: vi.fn(),
    find: vi.fn(() =>
      chain([{ _id: roomId, roomNumber: '102', status: 'AVAILABLE' }]),
    ),
  };
  const payments = { exists: vi.fn(async () => null) };
  const invoices = {
    recalculate: vi.fn(async () => invoice),
    getOrCreateForBooking: vi.fn(async () => invoice),
  };
  const send = vi.fn(async () => ({ accepted: true }));
  const sut = new CheckOutService(
    bookings as never,
    rooms as never,
    payments as never,
    invoices as never,
    { send } as never,
    // Nhân viên dịch vụ đã xác nhận kiểm tra phòng.
    { latestForSource: vi.fn(async () => ({ status: 'COMPLETED' })) } as never,
  );
  return { sut, send };
}

describe('CheckOutService email', () => {
  it('emails the final invoice when the guest is checked out', async () => {
    const { sut, send } = setup();

    await sut.checkOut(bookingId.toHexString());

    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'alice@example.com',
        template: 'CHECK_OUT_RECEIPT',
        data: expect.objectContaining({
          bookingCode: 'GE-123',
          totalAmount: 1_900_000,
          depositPaid: 170_000,
          finalPaid: 1_730_000,
        }),
      }),
    );
  });

  it('does not email again when the check-out is replayed', async () => {
    const { sut, send } = setup({ alreadyCheckedOut: true });

    await sut.checkOut(bookingId.toHexString());

    expect(send).not.toHaveBeenCalled();
  });

  it('still checks out when the email cannot be sent', async () => {
    const { sut, send } = setup();
    send.mockRejectedValueOnce(new Error('smtp down'));

    await expect(sut.checkOut(bookingId.toHexString())).resolves.toMatchObject({
      status: BookingStatus.CheckedOut,
    });
  });
});
