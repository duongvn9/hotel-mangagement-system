import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { randomBytes } from 'node:crypto';
import { Model, Types } from 'mongoose';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { Role } from '../../common/constants/role.enum.js';
import { RoomStatus } from '../../common/constants/room-status.enum.js';
import { Room } from '../rooms/schemas/room.schema.js';
import { Booking, BookingStatus } from './schemas/booking.schema.js';
import { RoomHold, type RoomHoldDocument } from './schemas/room-hold.schema.js';
import { AvailabilityClock } from './availability.adapters.js';
import {
  normalizeStay,
  overlaps,
  type StayInterval,
} from './availability.core.js';
import { CreateBookingDto } from './dto/create-booking.dto.js';

/** Nhân viên được phép đặt phòng hộ khách tại quầy. */
const STAFF_ROLES: readonly string[] = [Role.Receptionist, Role.Manager];
/** Thời hạn giữ phòng trước khi đặt cọc (phải khớp cửa sổ thanh toán VNPay). */
const HOLD_WINDOW_MS = 15 * 60 * 1000;
const MS_PER_DAY = 86_400_000;

type PopulatedRoom = {
  _id: Types.ObjectId;
  status: RoomStatus;
  isActive: boolean;
  roomType: { _id: Types.ObjectId; basePrice: number; adultCapacity: number; childCapacity: number; isActive: boolean } | null;
};

@Injectable()
export class BookingsService {
  constructor(
    @InjectModel(Booking.name) private readonly bookings: Model<Booking>,
    @InjectModel(RoomHold.name) private readonly holds: Model<RoomHold>,
    @InjectModel(Room.name) private readonly rooms: Model<Room>,
    @Inject(AvailabilityClock) private readonly clock: AvailabilityClock,
  ) {}

  async create(dto: CreateBookingDto, user: AuthUser) {
    if (user.role !== Role.Customer && !STAFF_ROLES.includes(user.role)) {
      throw new BadRequestException('This role cannot create bookings');
    }
    const roomIds = dto.rooms.map((id) => new Types.ObjectId(id));
    if (new Set(dto.rooms).size !== dto.rooms.length) {
      throw new BadRequestException('Duplicate rooms in request');
    }
    let stay: StayInterval;
    try {
      stay = normalizeStay(dto);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Invalid stay dates',
      );
    }

    const { roomTotal } = await this.priceRooms(roomIds, dto.guests, stay);
    const now = this.clock.now();
    await this.assertRoomsFree(roomIds, stay, now);

    const booking = await this.createBookingDocument(dto, roomIds, stay, {
      roomTotal,
      customer: user.role === Role.Customer ? new Types.ObjectId(user.id) : undefined,
    });

    let hold: RoomHoldDocument;
    try {
      hold = await this.holds.create({
        booking: booking._id,
        rooms: roomIds,
        checkIn: stay.checkIn,
        checkOut: stay.checkOut,
        expiresAt: new Date(now.getTime() + HOLD_WINDOW_MS),
        isActive: true,
      });
    } catch (error) {
      // Giữ nhất quán: không để lại booking không có hold.
      await this.bookings.deleteOne({ _id: booking._id });
      throw error;
    }

    if (!(await this.wonTheRace(hold._id, roomIds, stay, now))) {
      await this.holds.deleteOne({ _id: hold._id });
      await this.bookings.deleteOne({ _id: booking._id });
      throw new ConflictException(
        'One or more rooms were just taken; please choose again',
      );
    }

    return {
      id: String(booking._id),
      code: booking.code,
      status: booking.status,
      rooms: dto.rooms,
      checkIn: stay.checkIn.toISOString(),
      checkOut: stay.checkOut.toISOString(),
      guests: booking.guests,
      roomTotal: booking.roomTotal,
      depositAmount: booking.depositAmount,
      holdExpiresAt: hold.expiresAt.toISOString(),
    };
  }

  /** Giá server-side: tổng basePrice các phòng × số đêm. Cũng xác thực phòng đặt được. */
  private async priceRooms(
    roomIds: Types.ObjectId[],
    guests: number,
    stay: StayInterval,
  ): Promise<{ roomTotal: number }> {
    const rows = await this.rooms
      .find({ _id: { $in: roomIds } })
      .populate<{ roomType: PopulatedRoom['roomType'] }>(
        'roomType',
        'basePrice adultCapacity childCapacity isActive',
      )
      .lean<PopulatedRoom[]>()
      .exec();

    if (rows.length !== roomIds.length) {
      throw new BadRequestException('One or more rooms do not exist');
    }
    const nights = Math.round(
      (stay.checkOut.getTime() - stay.checkIn.getTime()) / MS_PER_DAY,
    );
    if (!Number.isSafeInteger(nights) || nights <= 0) {
      throw new BadRequestException('Stay must cover at least one night');
    }

    let capacity = 0;
    let perNight = 0;
    for (const room of rows) {
      if (!room.isActive || room.status === RoomStatus.Maintenance) {
        throw new ConflictException(`Room ${room._id} is not bookable`);
      }
      if (!room.roomType || !room.roomType.isActive) {
        throw new ConflictException(`Room ${room._id} has no active room type`);
      }
      capacity += room.roomType.adultCapacity + room.roomType.childCapacity;
      perNight += room.roomType.basePrice;
    }
    if (guests > capacity) {
      throw new BadRequestException('Selected rooms cannot hold the party size');
    }
    return { roomTotal: perNight * nights };
  }

  /** Chặn trước nếu phòng đã bị booking chắc chắn hoặc hold còn hiệu lực chiếm. */
  private async assertRoomsFree(
    roomIds: Types.ObjectId[],
    stay: StayInterval,
    now: Date,
  ): Promise<void> {
    if (await this.hasConflict(roomIds, stay, now)) {
      throw new ConflictException(
        'One or more rooms are not available for the selected dates',
      );
    }
  }

  private async hasConflict(
    roomIds: Types.ObjectId[],
    stay: StayInterval,
    now: Date,
    excludeHoldId?: Types.ObjectId,
    earlierThanHoldId?: Types.ObjectId,
  ): Promise<boolean> {
    const blocking = await this.bookings
      .find({
        rooms: { $in: roomIds },
        isActive: true,
        status: { $in: [BookingStatus.Confirmed, BookingStatus.CheckedIn] },
      })
      .select('checkIn checkOut')
      .lean()
      .exec();
    if (blocking.some((record) => this.conflicts(stay, record))) return true;

    const holdFilter: Record<string, unknown> = {
      rooms: { $in: roomIds },
      isActive: true,
      expiresAt: { $gt: now },
    };
    if (excludeHoldId) holdFilter._id = { $ne: excludeHoldId };
    const activeHolds = await this.holds
      .find(holdFilter)
      .select('booking checkIn checkOut')
      .lean()
      .exec();
    for (const hold of activeHolds) {
      if (!this.conflicts(stay, hold)) continue;
      if (earlierThanHoldId && !(String(hold._id) < String(earlierThanHoldId)))
        continue;
      const parent = await this.bookings
        .findById(hold.booking)
        .select('status isActive')
        .lean()
        .exec();
      if (
        !parent ||
        !parent.isActive ||
        [BookingStatus.Cancelled, BookingStatus.CheckedOut].includes(
          parent.status,
        )
      ) {
        continue;
      }
      return true;
    }
    return false;
  }

  /**
   * Sau khi chèn hold: ta thắng nếu không có booking chắc chắn đè lên, và không có
   * hold đang hiệu lực nào khác (_id nhỏ hơn = giành trước) trùng phòng/ngày với ta.
   * Booking của ta đang PENDING_DEPOSIT nên không lọt vào truy vấn blocking booking.
   */
  private async wonTheRace(
    holdId: Types.ObjectId,
    roomIds: Types.ObjectId[],
    stay: StayInterval,
    now: Date,
  ): Promise<boolean> {
    return !(await this.hasConflict(roomIds, stay, now, holdId, holdId));
  }

  private conflicts(
    stay: StayInterval,
    record: { checkIn: Date; checkOut: Date },
  ): boolean {
    try {
      return overlaps(stay, normalizeStay(record));
    } catch {
      return true;
    }
  }

  private async createBookingDocument(
    dto: CreateBookingDto,
    roomIds: Types.ObjectId[],
    stay: StayInterval,
    extra: { roomTotal: number; customer?: Types.ObjectId },
  ) {
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        return await this.bookings.create({
          code: this.newBookingCode(),
          ...(extra.customer ? { customer: extra.customer } : {}),
          guestName: dto.guestName.trim(),
          guestEmail: dto.guestEmail.trim(),
          guestPhone: dto.guestPhone.trim(),
          rooms: roomIds,
          checkIn: stay.checkIn,
          checkOut: stay.checkOut,
          guests: dto.guests,
          status: BookingStatus.PendingDeposit,
          roomTotal: extra.roomTotal,
          // Chính sách đặt cọc: trả trước toàn bộ tiền phòng để xác nhận (placeholder chờ SRS).
          depositAmount: extra.roomTotal,
        });
      } catch (error) {
        if ((error as { code?: number }).code === 11000 && attempt < 4) continue;
        throw error;
      }
    }
    throw new ConflictException('Could not allocate a unique booking code');
  }

  private newBookingCode(): string {
    return `BK${Date.now().toString(36).toUpperCase()}${randomBytes(3)
      .toString('hex')
      .toUpperCase()}`;
  }
}
