import { NotFoundException } from '@nestjs/common';
import { Types, type Model } from 'mongoose';
import { BookingStatus, Booking } from '../bookings/schemas/booking.schema.js';
import { Room } from '../rooms/schemas/room.schema.js';
import { ServiceOrder } from '../service-orders/schemas/service-order.schema.js';
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
    status: BookingStatus.CheckedIn,
    checkOut: new Date('3000-01-01'),
  });
  const setup = (
    value: unknown = booking(),
    room: unknown = { _id: roomId },
    order: unknown = null,
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
    const orders = {
      findOne: vi
        .fn()
        .mockReturnValue({ exec: vi.fn().mockResolvedValue(order) }),
    };
    return {
      orders,
      adapter: new IssueContextAdapter(
        bookings as unknown as Model<Booking>,
        rooms as unknown as Model<Room>,
        orders as unknown as Model<ServiceOrder>,
      ),
      rooms,
    };
  };

  it('allows owned active checked-in bookings on or before the checkout date', async () => {
    const { adapter } = setup();
    await expect(
      adapter.resolve(String(owner), String(bookingId)),
    ).resolves.toEqual({ booking: bookingId });
  });

  it('rejects checked-in bookings whose checkout date has already passed', async () => {
    const { adapter } = setup({
      ...booking(),
      checkOut: new Date('2000-01-01'),
    });
    await expect(
      adapter.resolve(String(owner), String(bookingId)),
    ).rejects.toThrow(new NotFoundException('Booking not found'));
  });

  it.each(
    Object.values(BookingStatus).filter(
      (status) => status !== BookingStatus.CheckedIn,
    ),
  )('rejects %s bookings', async (status) => {
    const { adapter } = setup({ ...booking(), status });
    await expect(
      adapter.resolve(String(owner), String(bookingId)),
    ).rejects.toThrow('Booking not found');
  });

  it.each(['AVAILABLE', 'OCCUPIED', 'MAINTENANCE'])(
    'does not restrict room status %s',
    async (status) => {
      const { adapter } = setup(booking(), { _id: roomId, status });
      await expect(
        adapter.resolve(String(owner), String(bookingId), String(roomId)),
      ).resolves.toEqual({ booking: bookingId, room: roomId });
    },
  );

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

  it.each(['PENDING_REVIEW', 'ACCEPTED', 'REJECTED'])(
    'accepts owned related service orders with review status %s',
    async (reviewStatus) => {
      const orderId = new Types.ObjectId();
      const service = new Types.ObjectId();
      const { adapter, orders } = setup(
        booking(),
        { _id: roomId },
        { _id: orderId, service, reviewStatus },
      );
      await expect(
        adapter.resolve(
          String(owner),
          String(bookingId),
          String(roomId),
          String(orderId),
        ),
      ).resolves.toEqual({
        booking: bookingId,
        room: roomId,
        serviceOrder: orderId,
        service,
      });
      expect(orders.findOne).toHaveBeenCalledWith({
        _id: String(orderId),
        booking: bookingId,
        customer: owner,
      });
    },
  );

  it('rejects unavailable service orders using both customer and booking scope', async () => {
    const { adapter } = setup();
    await expect(
      adapter.resolve(
        String(owner),
        String(bookingId),
        undefined,
        String(new Types.ObjectId()),
      ),
    ).rejects.toThrow('Service order not found');
  });

  it('rejects missing or inactive rooms', async () => {
    const { adapter } = setup(booking(), null);
    await expect(
      adapter.resolve(String(owner), String(bookingId), String(roomId)),
    ).rejects.toThrow('Room not found');
  });
});
