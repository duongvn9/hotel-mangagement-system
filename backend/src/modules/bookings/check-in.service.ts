import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { BookingStatus } from '../../common/constants/booking-status.enum.js';
import { RoomStatus } from '../../common/constants/room-status.enum.js';
import { Room } from '../rooms/schemas/room.schema.js';
import { AvailabilityClock } from './availability.adapters.js';
import { AvailabilityService } from './availability.service.js';
import {
  applyReplacements,
  checkInStatusError,
  checkInWindowError,
  describeNotReady,
  notReadyRooms,
  replacementShapeError,
  type RoomReplacement,
} from './check-in.core.js';
import type {
  CheckInDto,
  CheckInOptionsResponse,
  CheckInResult,
} from './dto/check-in.dto.js';
import { businessDay } from './room-status-board.core.js';
import { Booking } from './schemas/booking.schema.js';

type LeanRoom = {
  _id: Types.ObjectId;
  roomNumber: string;
  floor: number;
  status: RoomStatus;
  isActive: boolean;
  roomType: { _id: Types.ObjectId; name?: string } | null;
};

const ROOM_FIELDS = 'roomNumber floor status isActive roomType';

@Injectable()
export class CheckInService {
  constructor(
    @InjectModel(Booking.name) private readonly bookings: Model<Booking>,
    @InjectModel(Room.name) private readonly rooms: Model<Room>,
    private readonly availability: AvailabilityService,
    @Inject(AvailabilityClock) private readonly clock: AvailabilityClock,
  ) {}

  /**
   * UC16: lễ tân nhận phòng cho khách. Booking CONFIRMED chuyển sang CHECKED_IN và các phòng
   * sang OCCUPIED. Phòng chưa sẵn sàng có thể đổi ngay sang phòng khác cùng loại (tiền phòng
   * không đổi). Mongo không có transaction ở đây nên mọi bước ghi đều có điều kiện, và nếu
   * một phòng bị người khác lấy mất thì hoàn tác phần đã làm rồi trả 409.
   */
  async checkIn(bookingId: string, dto: CheckInDto): Promise<CheckInResult> {
    const booking = await this.confirmedBooking(bookingId);
    const windowError = checkInWindowError(
      businessDay(this.clock.now()),
      booking.checkIn,
      booking.checkOut,
    );
    if (windowError) throw new ConflictException(windowError);

    const current = booking.rooms.map(String);
    const replacements: RoomReplacement[] = dto.replacements ?? [];
    const shapeError = replacementShapeError(current, replacements);
    if (shapeError) throw new BadRequestException(shapeError);
    if (replacements.length > 0) {
      await this.assertReplacementsUsable(booking, replacements);
    }

    const finalIds = applyReplacements(current, replacements);
    const finalRooms = await this.loadRooms(finalIds);
    const blocked = notReadyRooms(finalRooms);
    if (blocked.length > 0) {
      throw new ConflictException(describeNotReady(blocked));
    }

    const swap = new Map(replacements.map(({ from, to }) => [from, to]));
    const roomObjectIds = finalIds.map((id) => new Types.ObjectId(id));
    const now = this.clock.now();
    const previous = await this.bookings
      .findOneAndUpdate(
        { _id: booking._id, status: BookingStatus.Confirmed, isActive: true },
        {
          $set: {
            status: BookingStatus.CheckedIn,
            checkedInAt: now,
            rooms: roomObjectIds,
            rateSnapshot: booking.rateSnapshot.map((entry) => ({
              room: new Types.ObjectId(
                swap.get(String(entry.room)) ?? String(entry.room),
              ),
              ratePerNight: entry.ratePerNight,
            })),
          },
        },
        { returnDocument: 'before' },
      )
      .lean()
      .exec();
    if (!previous) {
      throw new ConflictException(
        'The booking was just changed; reload it and try again',
      );
    }

    const occupied: Types.ObjectId[] = [];
    for (const roomId of roomObjectIds) {
      const result = await this.rooms.updateOne(
        { _id: roomId, isActive: true, status: RoomStatus.Available },
        { $set: { status: RoomStatus.Occupied } },
      );
      if (result.modifiedCount !== 1) {
        await this.rooms.updateMany(
          { _id: { $in: occupied }, status: RoomStatus.Occupied },
          { $set: { status: RoomStatus.Available } },
        );
        await this.bookings.updateOne(
          { _id: booking._id },
          {
            $set: {
              status: BookingStatus.Confirmed,
              rooms: previous.rooms,
              rateSnapshot: previous.rateSnapshot,
            },
            $unset: { checkedInAt: 1 },
          },
        );
        throw new ConflictException(
          'One or more rooms were just taken; please choose again',
        );
      }
      occupied.push(roomId);
    }

    const byId = new Map(finalRooms.map((room) => [String(room._id), room]));
    return {
      id: String(booking._id),
      code: booking.code,
      status: BookingStatus.CheckedIn,
      checkedInAt: now.toISOString(),
      rooms: finalIds.map((id) => ({
        id,
        roomNumber: byId.get(id)?.roomNumber ?? '',
      })),
    };
  }

  /** Từng phòng của booking đã sẵn sàng chưa, và nếu chưa thì có thể đổi sang phòng nào. */
  async options(bookingId: string): Promise<CheckInOptionsResponse> {
    const booking = await this.confirmedBooking(bookingId);
    const current = booking.rooms.map(String);
    const rooms = await this.loadRooms(current);
    const blockedTypes = [
      ...new Set(
        rooms
          .filter((room) => notReadyRooms([room]).length > 0)
          .map((room) => String(room.roomType?._id)),
      ),
    ];

    const replacementsByType = new Map<
      string,
      { id: string; roomNumber: string; floor: number }[]
    >();
    for (const typeId of blockedTypes) {
      const free = await this.availability.findAvailableRooms({
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        guests: 1,
        roomTypeId: typeId,
      });
      const candidates = await this.rooms
        .find({
          _id: {
            $in: free
              .map((room) => room.id)
              .filter((id) => !current.includes(id)),
          },
          isActive: true,
          status: RoomStatus.Available,
        })
        .select('roomNumber floor')
        .lean()
        .exec();
      replacementsByType.set(
        typeId,
        candidates
          .map((room) => ({
            id: String(room._id),
            roomNumber: room.roomNumber,
            floor: room.floor,
          }))
          .sort((a, b) =>
            a.roomNumber.localeCompare(b.roomNumber, undefined, {
              numeric: true,
            }),
          ),
      );
    }

    return {
      bookingId: String(booking._id),
      code: booking.code,
      rooms: rooms.map((room) => {
        const [blocked] = notReadyRooms([room]);
        return {
          id: String(room._id),
          roomNumber: room.roomNumber,
          roomTypeName: room.roomType?.name ?? '',
          ready: blocked === undefined,
          status: blocked ? blocked.reason : room.status,
          replacements: blocked
            ? (replacementsByType.get(String(room.roomType?._id)) ?? [])
            : [],
        };
      }),
    };
  }

  private async confirmedBooking(bookingId: string) {
    if (!/^[a-f\d]{24}$/i.test(bookingId)) {
      throw new BadRequestException('Invalid booking ID');
    }
    const booking = await this.bookings.findById(bookingId);
    if (!booking || !booking.isActive) {
      throw new NotFoundException('Booking not found');
    }
    const statusError = checkInStatusError(booking.status);
    if (statusError) throw new ConflictException(statusError);
    return booking;
  }

  /** Phòng của booking, giữ đúng thứ tự `ids`. */
  private async loadRooms(ids: string[]): Promise<LeanRoom[]> {
    const rows = await this.rooms
      .find({ _id: { $in: ids.map((id) => new Types.ObjectId(id)) } })
      .select(ROOM_FIELDS)
      .populate<{ roomType: LeanRoom['roomType'] }>('roomType', 'name')
      .lean<LeanRoom[]>()
      .exec();
    const byId = new Map(rows.map((room) => [String(room._id), room]));
    return ids.map((id) => {
      const room = byId.get(id);
      if (!room) throw new BadRequestException(`Room ${id} does not exist`);
      return room;
    });
  }

  /** Phòng thay thế phải cùng loại, sẵn sàng và còn trống suốt thời gian ở. */
  private async assertReplacementsUsable(
    booking: { checkIn: Date; checkOut: Date },
    replacements: RoomReplacement[],
  ): Promise<void> {
    const sources = await this.loadRooms(replacements.map((item) => item.from));
    const targets = await this.loadRooms(replacements.map((item) => item.to));
    const freeByType = new Map<string, Set<string>>();
    for (const [index, target] of targets.entries()) {
      const typeId = String(target.roomType?._id);
      if (typeId !== String(sources[index]?.roomType?._id)) {
        throw new ConflictException(
          `Room ${target.roomNumber} is not the same room type as the room it replaces`,
        );
      }
      const [blocked] = notReadyRooms([target]);
      if (blocked) {
        throw new ConflictException(describeNotReady([blocked]));
      }
      if (!freeByType.has(typeId)) {
        const free = await this.availability.findAvailableRooms({
          checkIn: booking.checkIn,
          checkOut: booking.checkOut,
          guests: 1,
          roomTypeId: typeId,
        });
        freeByType.set(typeId, new Set(free.map((room) => room.id)));
      }
      if (!freeByType.get(typeId)?.has(String(target._id))) {
        throw new ConflictException(
          `Room ${target.roomNumber} is not available for the booked stay`,
        );
      }
    }
  }
}
