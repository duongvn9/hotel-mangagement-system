import { NotFoundException } from '@nestjs/common';
import { Types, type Model } from 'mongoose';
import { BookingStatus, Booking } from '../bookings/schemas/booking.schema.js';
import { Room } from '../rooms/schemas/room.schema.js';
import { IssueContextAdapter } from './issue-context.adapter.js';

describe('IssueContextAdapter', () => {
  const owner = new Types.ObjectId();
  const roomId = new Types.ObjectId();
  const bookingId = new Types.ObjectId();
  const booking = () => ({
    _id: bookingId,
    customer: owner,
    rooms: [roomId],
    isActive: true,
    status: BookingStatus.Confirmed,
  });
  const setup = (
    value: unknown = booking(),
    room: unknown = { _id: roomId },
  ) => {
    const bookings = {
      findById: vi
        .fn()
        .mockReturnValue({ exec: vi.fn().mockResolvedValue(value) }),
    };
    const rooms = {
      findOne: vi
        .fn()
        .mockReturnValue({ exec: vi.fn().mockResolvedValue(room) }),
    };
    return {
      adapter: new IssueContextAdapter(
        bookings as unknown as Model<Booking>,
        rooms as unknown as Model<Room>,
      ),
      rooms,
    };
  };

  it.each(
    Object.values(BookingStatus).filter(
      (status) => status !== BookingStatus.Cancelled,
    ),
  )('allows owned active %s without date restrictions', async (status) => {
    const { adapter } = setup({ ...booking(), status });
    await expect(
      adapter.resolve(String(owner), String(bookingId)),
    ).resolves.toEqual({ booking: bookingId });
  });

  it.each([
    null,
    { ...booking(), customer: new Types.ObjectId() },
    { ...booking(), customer: undefined },
    { ...booking(), isActive: false },
    { ...booking(), status: BookingStatus.Cancelled },
  ])('hides unavailable or foreign bookings', async (value) => {
    const { adapter } = setup(value);
    await expect(
      adapter.resolve(String(owner), String(bookingId)),
    ).rejects.toThrow(new NotFoundException('Booking not found'));
  });

  it('accepts an active room in the booking', async () => {
    const { adapter, rooms } = setup();
    await expect(
      adapter.resolve(String(owner), String(bookingId), String(roomId)),
    ).resolves.toEqual({ booking: bookingId, room: roomId });
    expect(rooms.findOne).toHaveBeenCalledWith({
      _id: String(roomId),
      isActive: true,
    });
  });

  it('rejects unrelated rooms without looking them up', async () => {
    const { adapter, rooms } = setup();
    await expect(
      adapter.resolve(
        String(owner),
        String(bookingId),
        String(new Types.ObjectId()),
      ),
    ).rejects.toThrow('Room not found');
    expect(rooms.findOne).not.toHaveBeenCalled();
  });

  it('rejects missing or inactive rooms', async () => {
    const { adapter } = setup(booking(), null);
    await expect(
      adapter.resolve(String(owner), String(bookingId), String(roomId)),
    ).rejects.toThrow('Room not found');
  });
});
