import { Types } from 'mongoose';
import { BookingStatus } from '../../common/constants/booking-status.enum.js';
import { RoomStatus } from '../../common/constants/room-status.enum.js';
import { CheckInService } from './check-in.service.js';

const roomId = new Types.ObjectId();
const bookingId = new Types.ObjectId();
const KEY = 'private/check-ins/123e4567-e89b-12d3-a456-426614174000.jpg';
const KEY2 = 'private/check-ins/123e4567-e89b-12d3-a456-426614174001.jpg';
const photo = {
  buffer: Buffer.from([255, 216, 255, 0]),
  mimetype: 'image/jpeg',
  size: 4,
};

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
    depositAmount: 170_000,
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
  const storage = {
    putAll: vi.fn(async (files: unknown[]) => files.map(() => KEY)),
    removeAll: vi.fn(async () => undefined),
    get: vi.fn(),
    remove: vi.fn(async () => undefined),
  };
  const sut = new CheckInService(
    bookings as never,
    rooms as never,
    {} as never,
    clock as never,
    { send } as never,
    // Cọc đã được thu.
    { exists: vi.fn(async () => ({ _id: new Types.ObjectId() })) } as never,
    storage as never,
  );
  return { sut, send, bookings, rooms, storage };
}

describe('CheckInService email', () => {
  it('emails the guest a check-in confirmation naming the room', async () => {
    const { sut, send } = setup();

    await sut.checkIn(bookingId.toHexString(), {}, [photo]);

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
      sut.checkIn(bookingId.toHexString(), {}, [photo]),
    ).resolves.toMatchObject({ status: BookingStatus.CheckedIn });
  });

  it.each([
    ['no photo', undefined],
    ['an empty list', []],
    ['six photos', Array.from({ length: 6 }, () => photo)],
  ])('refuses check-in with %s and writes nothing', async (_name, photos) => {
    const { sut, bookings, storage } = setup();

    await expect(
      sut.checkIn(bookingId.toHexString(), {}, photos),
    ).rejects.toThrow(/1 to 5/i);
    expect(storage.putAll).not.toHaveBeenCalled();
    expect(bookings.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('stores up to five photos privately and records their keys on the booking', async () => {
    const { sut, bookings, storage } = setup();
    const photos = Array.from({ length: 5 }, () => photo);

    await sut.checkIn(bookingId.toHexString(), {}, photos);

    expect(storage.putAll).toHaveBeenCalledWith(photos);
    expect(bookings.findOneAndUpdate).toHaveBeenCalledWith(
      expect.anything(),
      {
        $set: expect.objectContaining({
          checkInEvidence: [KEY, KEY, KEY, KEY, KEY],
        }),
      },
      expect.anything(),
    );
  });

  it('uploads nothing when the check-in is refused before the write', async () => {
    const { sut, rooms, storage } = setup();
    rooms.find.mockReturnValueOnce(
      chain([
        {
          _id: roomId,
          roomNumber: '102',
          floor: 1,
          status: RoomStatus.Cleaning,
          isActive: true,
          roomType: null,
        },
      ]),
    );

    await expect(
      sut.checkIn(bookingId.toHexString(), {}, [photo]),
    ).rejects.toThrow(/not ready/i);
    expect(storage.putAll).not.toHaveBeenCalled();
  });

  it('deletes the stored photos when the booking was changed concurrently', async () => {
    const { sut, bookings, storage } = setup();
    bookings.findOneAndUpdate.mockReturnValueOnce(chain(null));

    await expect(
      sut.checkIn(bookingId.toHexString(), {}, [photo]),
    ).rejects.toThrow(/just changed/i);
    expect(storage.removeAll).toHaveBeenCalledWith([KEY]);
  });

  it('deletes the stored photos when a room is taken and the check-in is rolled back', async () => {
    const { sut, rooms, storage } = setup();
    rooms.updateOne.mockResolvedValueOnce({ modifiedCount: 0 });

    await expect(
      sut.checkIn(bookingId.toHexString(), {}, [photo]),
    ).rejects.toThrow(/just taken/i);
    expect(storage.removeAll).toHaveBeenCalledWith([KEY]);
  });

  it('counts the stored photos of a booking, zero when there are none', async () => {
    const { sut, bookings } = setup();
    bookings.findById.mockReturnValue(
      chain({ checkInEvidence: [KEY, KEY2] }) as never,
    );
    await expect(sut.evidenceCount(bookingId.toHexString())).resolves.toEqual({
      count: 2,
    });

    bookings.findById.mockReturnValue(chain({}) as never);
    await expect(sut.evidenceCount(bookingId.toHexString())).resolves.toEqual({
      count: 0,
    });
  });

  it('returns one stored photo by position, and 404s when it does not exist', async () => {
    const { sut, bookings, storage } = setup();
    bookings.findById.mockReturnValue(
      chain({ checkInEvidence: [KEY, KEY2] }) as never,
    );
    storage.get.mockResolvedValue({
      body: Uint8Array.from([1]),
      contentType: 'image/jpeg',
    });

    await expect(
      sut.evidencePhoto(bookingId.toHexString(), 1),
    ).resolves.toMatchObject({ contentType: 'image/jpeg' });
    expect(storage.get).toHaveBeenCalledWith(KEY2);

    await expect(sut.evidencePhoto(bookingId.toHexString(), 2)).rejects.toThrow(
      /no check-in photo/i,
    );
    await expect(
      sut.evidencePhoto(bookingId.toHexString(), -1),
    ).rejects.toThrow(/no check-in photo/i);
  });

  it('sends nothing for a booking without an email', async () => {
    const { sut, send } = setup('');

    await sut.checkIn(bookingId.toHexString(), {}, [photo]);

    expect(send).not.toHaveBeenCalled();
  });
});
