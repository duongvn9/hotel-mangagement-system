import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Booking, BookingStatus } from './schemas/booking.schema.js';
import { RoomHold } from './schemas/room-hold.schema.js';
import {
  AvailabilityClock,
  AvailabilityRoomSource,
} from './availability.adapters.js';
import {
  calculateAvailability,
  validateQuery,
  type AvailabilityQuery,
  type AvailableRoom,
} from './availability.core.js';

@Injectable()
export class AvailabilityService {
  constructor(
    @InjectModel(Booking.name) private readonly bookings: Model<Booking>,
    @InjectModel(RoomHold.name) private readonly holds: Model<RoomHold>,
    @Inject(AvailabilityRoomSource)
    private readonly rooms: AvailabilityRoomSource,
    @Inject(AvailabilityClock) private readonly clock: AvailabilityClock,
  ) {}

  async findAvailableRooms(query: AvailabilityQuery): Promise<AvailableRoom[]> {
    let stay;
    try {
      stay = validateQuery(query);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Invalid availability query',
      );
    }
    const now = this.clock.now();
    const candidates = await this.rooms.findCandidates({ ...query, ...stay });
    if (!candidates.length) return [];
    if (candidates.some((room) => !/^[a-f\d]{24}$/i.test(room.id)))
      throw new Error('Room adapter must return ObjectId strings');
    const ids = candidates.map((room) => new Types.ObjectId(room.id));
    const holds = await this.holds
      .find({ rooms: { $in: ids }, isActive: true, expiresAt: { $gt: now } })
      .select('booking rooms checkIn checkOut expiresAt isActive')
      .lean()
      .exec();
    const bookings = await this.bookings
      .find({
        $or: [
          {
            rooms: { $in: ids },
            isActive: true,
            status: { $in: [BookingStatus.Confirmed, BookingStatus.CheckedIn] },
          },
          { _id: { $in: holds.map((hold) => hold.booking).filter(Boolean) } },
        ],
      })
      .select('rooms checkIn checkOut status isActive')
      .lean()
      .exec();
    return calculateAvailability(
      query,
      candidates,
      bookings.map((booking) => ({
        ...booking,
        id: String(booking._id),
        rooms: (booking.rooms ?? []).map(String),
      })),
      holds.map((hold) => ({
        ...hold,
        bookingId: String(hold.booking),
        rooms: (hold.rooms ?? []).map(String),
      })),
      now,
    );
  }
}
