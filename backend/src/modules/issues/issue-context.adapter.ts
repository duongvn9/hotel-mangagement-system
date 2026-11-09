import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { BookingStatus } from '../../common/constants/booking-status.enum.js';
import { Booking } from '../bookings/schemas/booking.schema.js';
import { Room } from '../rooms/schemas/room.schema.js';
import { ServiceOrder } from '../service-orders/schemas/service-order.schema.js';

export interface IssueContext {
  booking: Types.ObjectId;
  room?: Types.ObjectId;
  serviceOrder?: Types.ObjectId;
  service?: Types.ObjectId;
}

@Injectable()
export class IssueContextAdapter {
  constructor(
    @InjectModel(Booking.name) private readonly bookings: Model<Booking>,
    @InjectModel(Room.name) private readonly rooms: Model<Room>,
    @InjectModel(ServiceOrder.name)
    private readonly orders: Model<ServiceOrder>,
  ) {}

  async roomNumbers(roomIds: Types.ObjectId[]): Promise<Map<string, string>> {
    const ids = [...new Map(roomIds.map((id) => [String(id), id])).values()];
    if (ids.length === 0) return new Map();
    const rooms = await this.rooms
      .find({ _id: { $in: ids } })
      .select({ _id: 1, roomNumber: 1 })
      .lean();
    return new Map(rooms.map((room) => [String(room._id), room.roomNumber]));
  }

  async reportContext(userId: string) {
    const bookings = await this.bookings
      .find({
        customer: new Types.ObjectId(userId),
        isActive: true,
        status: BookingStatus.CheckedIn,
      })
      .select({ _id: 1, code: 1, status: 1, checkIn: 1, checkOut: 1, rooms: 1 })
      .sort({ checkIn: -1, _id: -1 })
      .lean();
    const [rooms, orders] = await Promise.all([
      this.rooms
        .find({
          _id: { $in: bookings.flatMap((booking) => booking.rooms) },
          isActive: true,
        })
        .select({ _id: 1, roomNumber: 1 })
        .sort({ roomNumber: 1, _id: 1 })
        .lean(),
      this.orders
        .find({
          booking: { $in: bookings.map((booking) => booking._id) },
          customer: new Types.ObjectId(userId),
        })
        .select({
          _id: 1,
          booking: 1,
          serviceName: 1,
          reviewStatus: 1,
          executionStatus: 1,
        })
        .sort({ _id: 1 })
        .lean(),
    ]);
    return {
      items: bookings.map((booking) => ({
        id: String(booking._id),
        code: booking.code,
        status: booking.status,
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        rooms: rooms
          .filter((room) => booking.rooms.some((id) => id.equals(room._id)))
          .map((room) => ({
            id: String(room._id),
            roomNumber: room.roomNumber,
          })),
        serviceOrders: orders
          .filter((order) => order.booking.equals(booking._id))
          .map((order) => ({
            id: String(order._id),
            serviceName: order.serviceName,
            reviewStatus: order.reviewStatus,
            executionStatus: order.executionStatus,
          })),
      })),
    };
  }

  async resolve(
    userId: string,
    bookingId: string,
    roomId?: string,
    serviceOrderId?: string,
  ): Promise<IssueContext> {
    const booking = await this.bookings.findById(bookingId).exec();
    if (
      !booking ||
      !booking.customer?.equals(userId) ||
      !booking.isActive ||
      booking.status !== BookingStatus.CheckedIn
    )
      throw new NotFoundException('Booking not found');
    const context: IssueContext = { booking: booking._id };
    if (roomId) {
      if (!booking.rooms.some((room) => room.equals(roomId)))
        throw new NotFoundException('Room not found');
      const room = await this.rooms
        .findOne({ _id: roomId, isActive: true })
        .exec();
      if (!room) throw new NotFoundException('Room not found');
      context.room = room._id;
    }
    if (serviceOrderId) {
      const order = await this.orders
        .findOne({
          _id: serviceOrderId,
          booking: booking._id,
          customer: new Types.ObjectId(userId),
        })
        .exec();
      if (!order) throw new NotFoundException('Service order not found');
      context.serviceOrder = order._id;
      context.service = order.service;
    }
    return context;
  }
}
