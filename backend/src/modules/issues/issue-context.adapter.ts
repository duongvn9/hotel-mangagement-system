import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { BookingStatus } from '../../common/constants/booking-status.enum.js';
import { Booking } from '../bookings/schemas/booking.schema.js';
import { Room } from '../rooms/schemas/room.schema.js';

export interface IssueContext {
  booking: Types.ObjectId;
  room?: Types.ObjectId;
}

@Injectable()
export class IssueContextAdapter {
  constructor(
    @InjectModel(Booking.name) private readonly bookings: Model<Booking>,
    @InjectModel(Room.name) private readonly rooms: Model<Room>,
  ) {}

  async resolve(
    userId: string,
    bookingId: string,
    roomId?: string,
  ): Promise<IssueContext> {
    const booking = await this.bookings.findById(bookingId).exec();
    if (
      !booking ||
      !booking.customer?.equals(userId) ||
      !booking.isActive ||
      booking.status === BookingStatus.Cancelled
    ) {
      throw new NotFoundException('Booking not found');
    }
    if (!roomId) return { booking: booking._id };
    if (!booking.rooms.some((room) => room.equals(roomId))) {
      throw new NotFoundException('Room not found');
    }
    const room = await this.rooms
      .findOne({ _id: roomId, isActive: true })
      .exec();
    if (!room) throw new NotFoundException('Room not found');
    return { booking: booking._id, room: room._id };
  }
}
