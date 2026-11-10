import { Types } from 'mongoose';
import { BookingStatus } from '../../common/constants/booking-status.enum.js';
import { RoomStatus } from '../../common/constants/room-status.enum.js';
import { CheckInService } from './check-in.service.js';

const roomId = new Types.ObjectId();
const bookingId = new Types.ObjectId();

/** Chuỗi query của mongoose: select/populate/lean trả lại chính nó, exec trả kết quả. */
const chain = <T>(result: T) => {
  const query: Record<string, unknown> = {};
  for (const name of ['select', 'populate', 'lean']) query[name] = () => query;
  query.exec = async () => result;
  return query;
};

function setup(guestEmail: string | undefined = 'alice@example.com') {
  const booking = {
    _id: bookingId,
    code: 'GE-123',
    guestName: 'Alice',
    guestEmail,
    status: BookingStatus.Confirmed,
    isActive: true,
    checkIn: new Date('2026-11-09T07:00:00Z'),
    checkOut: new Date('2026-11-11T05:00:00Z'),
    rooms: [roomId],
    rateSnapshot: [{ room: roomId, ratePerNight: 850_000 }],
  };
  const bookings = {
    findById: vi.fn(async () => booking),
    findOneAndUpdate: vi.fn(() => chain(booking)),
    updateOne: vi.fn(),
  };
  const rooms = {
    find: vi.fn(() =>
      chain([
        {
          _id: roomId,
          roomNumber: '102',
          floor: 1,
          status: RoomStatus.Available,
          isActive: true,
          roomType: null,
        },
      ]),
    ),
    updateOne: vi.fn(async () => ({ modifiedCount: 1 })),
    updateMany: vi.fn(),
  };
  const clock = { now: () => new Date('2026-11-09T08:00:00Z') };
  const send = vi.fn(async () => ({ accepted: true }));
  const sut = new CheckInService(
    bookings as never,
    rooms as never,
    {} as never,
    clock as never,
    { send } as never,
  );
  return { sut, send, bookings };
}

describe('CheckInService email', () => {
  it('emails the guest a check-in confirmation naming the room', async () => {
    const { sut, send } = setup();

    await sut.checkIn(bookingId.toHexString(), {});

    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'alice@example.com',
        template: 'CHECK_IN_CONFIRMATION',
        data: expect.objectContaining({
          bookingCode: 'GE-123',
          roomsSummary: 'Phòng 102',
        }),
      }),
    );
  });

  it('still checks in when the email cannot be sent', async () => {
    const { sut, send } = setup();
    send.mockRejectedValueOnce(new Error('smtp down'));

    await expect(
      sut.checkIn(bookingId.toHexString(), {}),
    ).resolves.toMatchObject({ status: BookingStatus.CheckedIn });
  });

  it('sends nothing for a booking without an email', async () => {
    const { sut, send } = setup('');

    await sut.checkIn(bookingId.toHexString(), {});

    expect(send).not.toHaveBeenCalled();
  });
});
