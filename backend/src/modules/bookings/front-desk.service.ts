import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BookingStatus } from '../../common/constants/booking-status.enum.js';
import { AvailabilityClock } from './availability.adapters.js';
import { businessBoundary } from './availability.core.js';
import {
  BOOKING_ROOMS_POPULATE,
  toBookingListItem,
  type PopulatedListRoom,
} from './booking-list-item.js';
import type { BookingListItem } from './dto/list-bookings.dto.js';
import type { SameDayQuery, SameDayResponse } from './dto/same-day.dto.js';
import { businessDay } from './room-status-board.core.js';
import { Booking } from './schemas/booking.schema.js';
import { RoomHold } from './schemas/room-hold.schema.js';

const MS_PER_DAY = 86_400_000;

const byRoomThenCode = (a: BookingListItem, b: BookingListItem) =>
  (a.rooms[0]?.roomNumber ?? '').localeCompare(
    b.rooms[0]?.roomNumber ?? '',
    undefined,
    { numeric: true },
  ) || a.code.localeCompare(b.code);

@Injectable()
export class FrontDeskService {
  constructor(
    @InjectModel(Booking.name) private readonly bookings: Model<Booking>,
    @Inject(AvailabilityClock) private readonly clock: AvailabilityClock,
    @InjectModel(RoomHold.name) private readonly holds: Model<RoomHold>,
  ) {}

  /**
   * UC15: khách đến và khách đi trong một ngày (mặc định hôm nay, giờ Việt Nam).
   * Đến: nhận phòng đúng ngày, gồm chưa cọc, đã xác nhận và đã nhận phòng; đi: trả phòng
   * đúng ngày, gồm đang ở và đã trả phòng. Booking đã huỷ không có trong danh sách.
   */
  async sameDay(query: SameDayQuery): Promise<SameDayResponse> {
    const date = query.date ?? businessDay(this.clock.now());
    let dayStart: Date;
    try {
      dayStart = businessBoundary(date);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Invalid date',
      );
    }
    const inDay = {
      $gte: dayStart,
      $lt: new Date(dayStart.getTime() + MS_PER_DAY),
    };

    const load = async (
      filter: Record<string, unknown>,
    ): Promise<BookingListItem[]> => {
      const rows = await this.bookings
        .find({ isActive: true, ...filter })
        .populate<{ rooms: PopulatedListRoom[] }>(BOOKING_ROOMS_POPULATE)
        .lean()
        .exec();
      const held = rows.filter((row) => row.status === BookingStatus.RoomHeld);
      const live = held.length
        ? await this.holds
            .find({
              booking: { $in: held.map((row) => row._id) },
              isActive: true,
              expiresAt: { $gt: this.clock.now() },
            })
            .select('booking')
            .lean()
            .exec()
        : [];
      const liveIds = new Set(live.map((hold) => String(hold.booking)));
      return rows
        .filter(
          (row) =>
            row.status !== BookingStatus.RoomHeld ||
            liveIds.has(String(row._id)),
        )
        .map(toBookingListItem)
        .sort(byRoomThenCode);
    };
    const [arrivals, departures] = await Promise.all([
      load({
        checkIn: inDay,
        status: {
          $in: [
            BookingStatus.PendingDeposit,
            BookingStatus.RoomHeld,
            BookingStatus.Confirmed,
            BookingStatus.CheckedIn,
          ],
        },
      }),
      load({
        checkOut: inDay,
        status: { $in: [BookingStatus.CheckedIn, BookingStatus.CheckedOut] },
      }),
    ]);

    const count = (items: BookingListItem[], status: BookingStatus) =>
      items.filter((item) => item.status === status).length;
    return {
      date,
      summary: {
        arrivals: {
          total: arrivals.length,
          awaitingDeposit: count(arrivals, BookingStatus.PendingDeposit),
          ready: count(arrivals, BookingStatus.Confirmed),
          checkedIn: count(arrivals, BookingStatus.CheckedIn),
        },
        departures: {
          total: departures.length,
          awaitingCheckOut: count(departures, BookingStatus.CheckedIn),
          checkedOut: count(departures, BookingStatus.CheckedOut),
        },
      },
      arrivals,
      departures,
    };
  }
}
