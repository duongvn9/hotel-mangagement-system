import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { BookingStatus } from '../../common/constants/booking-status.enum.js';
import type { RoomStatus } from '../../common/constants/room-status.enum.js';
import { Room } from '../rooms/schemas/room.schema.js';
import { AvailabilityClock } from './availability.adapters.js';
import { businessBoundary } from './availability.core.js';
import type { RoomStatusBoardQuery } from './dto/room-status-board.dto.js';
import {
  buildRoomStatusBoard,
  businessDay,
  type BoardBooking,
  type BoardRoom,
  type RoomStatusBoard,
} from './room-status-board.core.js';
import { Booking } from './schemas/booking.schema.js';
import { RoomHold } from './schemas/room-hold.schema.js';

const MS_PER_DAY = 86_400_000;

type PopulatedRoom = {
  _id: Types.ObjectId;
  roomNumber: string;
  floor: number;
  status: RoomStatus;
  roomType: {
    _id: Types.ObjectId;
    name: string;
    adultCapacity: number;
    childCapacity: number;
  } | null;
};

@Injectable()
export class RoomStatusBoardService {
  constructor(
    @InjectModel(Room.name) private readonly rooms: Model<Room>,
    @InjectModel(Booking.name) private readonly bookings: Model<Booking>,
    @InjectModel(RoomHold.name) private readonly holds: Model<RoomHold>,
    @Inject(AvailabilityClock) private readonly clock: AvailabilityClock,
  ) {}

  /** UC13: trạng thái phòng trong một ngày (mặc định hôm nay) cho lễ tân/quản lý. */
  async board(query: RoomStatusBoardQuery): Promise<RoomStatusBoard> {
    const now = this.clock.now();
    const today = businessDay(now);
    const date = query.date ?? today;
    let dayStart: Date;
    try {
      dayStart = businessBoundary(date);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Invalid date',
      );
    }
    const dayEnd = new Date(dayStart.getTime() + MS_PER_DAY);

    const roomRows = await this.rooms
      .find({
        isActive: true,
        ...(query.floor === undefined ? {} : { floor: query.floor }),
        ...(query.roomTypeId
          ? { roomType: new Types.ObjectId(query.roomTypeId) }
          : {}),
      })
      .populate<{ roomType: PopulatedRoom['roomType'] }>(
        'roomType',
        'name adultCapacity childCapacity',
      )
      .lean<PopulatedRoom[]>()
      .exec();
    const boardRooms: BoardRoom[] = roomRows.map((room) => ({
      id: String(room._id),
      roomNumber: room.roomNumber,
      floor: room.floor,
      roomTypeId: room.roomType ? String(room.roomType._id) : '',
      roomTypeName: room.roomType?.name ?? '',
      capacity: room.roomType
        ? room.roomType.adultCapacity + room.roomType.childCapacity
        : 0,
      status: room.status,
    }));

    const bookingRows = await this.bookings
      .find({
        isActive: true,
        rooms: { $in: roomRows.map((room) => room._id) },
        status: {
          $in: [
            BookingStatus.CheckedIn,
            BookingStatus.Confirmed,
            BookingStatus.PendingDeposit,
          ],
        },
        checkIn: { $lt: dayEnd },
        checkOut: { $gt: dayStart },
      })
      .select('code status guestName rooms checkIn checkOut')
      .lean()
      .exec();

    const pending = bookingRows.filter(
      (booking) => booking.status === BookingStatus.PendingDeposit,
    );
    const liveHolds = pending.length
      ? await this.holds
          .find({
            booking: { $in: pending.map((booking) => booking._id) },
            isActive: true,
            expiresAt: { $gt: now },
          })
          .select('booking')
          .lean()
          .exec()
      : [];
    const liveHoldIds = new Set(liveHolds.map((hold) => String(hold.booking)));
    const liveHoldCodes = new Set(
      pending
        .filter((booking) => liveHoldIds.has(String(booking._id)))
        .map((booking) => booking.code),
    );

    const boardBookings: BoardBooking[] = bookingRows.map((booking) => ({
      code: booking.code,
      status: booking.status,
      guestName: booking.guestName,
      rooms: booking.rooms.map(String),
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
    }));

    return buildRoomStatusBoard({
      date,
      isToday: date === today,
      rooms: boardRooms,
      bookings: boardBookings,
      liveHoldCodes,
    });
  }
}
