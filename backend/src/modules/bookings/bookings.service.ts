import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { randomBytes } from 'node:crypto';
import { Model, Types } from 'mongoose';
import type { AuthUser } from '../../common/auth/auth-user.js';
import {
  authorizeBookingAccess,
  type BookingActor,
} from '../../common/auth/booking-access.js';
import { Role } from '../../common/constants/role.enum.js';
import { RoomStatus } from '../../common/constants/room-status.enum.js';
import { Room } from '../rooms/schemas/room.schema.js';
import { Booking, BookingStatus } from './schemas/booking.schema.js';
import { RoomHold, type RoomHoldDocument } from './schemas/room-hold.schema.js';
import { AvailabilityClock } from './availability.adapters.js';
import {
  businessBoundary,
  normalizeStay,
  overlaps,
  type StayInterval,
} from './availability.core.js';
import {
  BOOKING_ROOMS_POPULATE,
  toBookingListItem,
  type PopulatedListRoom,
} from './booking-list-item.js';
import {
  CreateBookingDto,
  UpdateBookingDto,
} from './dto/create-booking.dto.js';
import type {
  BookingListResponse,
  ListBookingsQuery,
} from './dto/list-bookings.dto.js';

/** Thời hạn giữ phòng trước khi đặt cọc (phải khớp cửa sổ thanh toán VNPay). */
const HOLD_WINDOW_MS = 15 * 60 * 1000;
const MS_PER_DAY = 86_400_000;
/** Tỷ lệ đặt cọc trên tiền phòng (placeholder, chờ SRS chốt chính thức). */
export const DEPOSIT_RATE = 0.3;

interface RoomRate {
  room: Types.ObjectId;
  ratePerNight: number;
}

type PopulatedRoom = {
  _id: Types.ObjectId;
  status: RoomStatus;
  isActive: boolean;
  roomType: {
    _id: Types.ObjectId;
    basePrice: number;
    adultCapacity: number;
    childCapacity: number;
    isActive: boolean;
  } | null;
};

@Injectable()
export class BookingsService {
  constructor(
    @InjectModel(Booking.name) private readonly bookings: Model<Booking>,
    @InjectModel(RoomHold.name) private readonly holds: Model<RoomHold>,
    @InjectModel(Room.name) private readonly rooms: Model<Room>,
    @Inject(AvailabilityClock) private readonly clock: AvailabilityClock,
  ) {}

  async create(dto: CreateBookingDto, user?: AuthUser) {
    // Public: Guest (không đăng nhập) đặt được; Customer đăng nhập gắn booking vào tài
    // khoản; vai trò khác coi như đặt hộ tại quầy (không gắn customer).
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

    const { roomTotal, rates } = await this.priceRooms(
      roomIds,
      dto.guests,
      stay,
    );
    const now = this.clock.now();
    await this.assertRoomsFree(roomIds, stay, now);

    const booking = await this.createBookingDocument(dto, roomIds, stay, {
      roomTotal,
      rates,
      customer:
        user?.role === Role.Customer ? new Types.ObjectId(user.id) : undefined,
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

  /**
   * UC08: lễ tân/quản lý đặt phòng cho khách tại quầy. Khách đã có mặt nên booking vào
   * thẳng CONFIRMED (không cọc VNPay, không RoomHold 15 phút) và chiếm phòng ngay. Dùng
   * chung bước tính giá và kiểm tra phòng trống với luồng online.
   */
  async createWalkIn(dto: CreateBookingDto, user: AuthUser) {
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

    const { roomTotal, rates } = await this.priceRooms(
      roomIds,
      dto.guests,
      stay,
    );
    await this.assertRoomsFree(roomIds, stay, this.clock.now());

    const booking = await this.createBookingDocument(dto, roomIds, stay, {
      roomTotal,
      rates,
      status: BookingStatus.Confirmed,
      createdBy: new Types.ObjectId(user.id),
    });

    // Hai lễ tân đặt trùng phòng cùng lúc: booking tạo trước (_id nhỏ hơn) thắng.
    if (await this.lostConfirmedRace(booking._id, roomIds, stay)) {
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
    };
  }

  /**
   * UC10: danh sách booking cho lễ tân/quản lý, lọc theo trạng thái, từ khoá và ngày nhận
   * phòng (theo ngày làm việc giờ Việt Nam, gồm cả hai đầu), mới nhận phòng nhất trước.
   */
  async list(query: ListBookingsQuery): Promise<BookingListResponse> {
    const filter: Record<string, unknown> = { isActive: true };
    if (query.status) filter.status = query.status;
    if (query.q) {
      const pattern = {
        $regex: query.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        $options: 'i',
      };
      filter.$or = [
        { code: pattern },
        { guestName: pattern },
        { guestEmail: pattern },
        { guestPhone: pattern },
      ];
    }
    if (query.checkInFrom || query.checkInTo) {
      const range: Record<string, Date> = {};
      try {
        if (query.checkInFrom) range.$gte = businessBoundary(query.checkInFrom);
        if (query.checkInTo)
          range.$lt = new Date(
            businessBoundary(query.checkInTo).getTime() + MS_PER_DAY,
          );
      } catch (error) {
        throw new BadRequestException(
          error instanceof Error ? error.message : 'Invalid date filter',
        );
      }
      filter.checkIn = range;
    }

    const [rows, total] = await Promise.all([
      this.bookings
        .find(filter)
        .sort({ checkIn: -1, _id: -1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .populate<{ rooms: PopulatedListRoom[] }>(BOOKING_ROOMS_POPULATE)
        .lean()
        .exec(),
      this.bookings.countDocuments(filter),
    ]);

    return {
      items: rows.map(toBookingListItem),
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  /**
   * UC11: lễ tân/quản lý sửa booking PENDING_DEPOSIT hoặc CONFIRMED (trước check-in). Đổi
   * phòng/ngày/số khách thì tính lại giá và kiểm tra lại phòng trống, bỏ qua chính booking
   * này; PENDING_DEPOSIT cập nhật cả RoomHold và tiền cọc, CONFIRMED giữ nguyên tiền cọc
   * (khách có thể đã cọc, phần chênh lệch xử lý ở hóa đơn cuối).
   */
  async update(bookingId: string, dto: UpdateBookingDto) {
    if (!/^[a-f\d]{24}$/i.test(bookingId)) {
      throw new BadRequestException('Invalid booking ID');
    }
    const fields = Object.values(dto).filter((value) => value !== undefined);
    if (fields.length === 0) {
      throw new BadRequestException('Nothing to update');
    }
    if (dto.rooms && new Set(dto.rooms).size !== dto.rooms.length) {
      throw new BadRequestException('Duplicate rooms in request');
    }
    const booking = await this.bookings.findById(bookingId);
    if (!booking || !booking.isActive) {
      throw new NotFoundException('Booking not found');
    }
    if (
      ![BookingStatus.PendingDeposit, BookingStatus.Confirmed].includes(
        booking.status,
      )
    ) {
      throw new ConflictException(
        'Only a pending or confirmed booking can be updated',
      );
    }

    const previous = {
      rooms: booking.rooms,
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
      guests: booking.guests,
      guestName: booking.guestName,
      guestEmail: booking.guestEmail,
      guestPhone: booking.guestPhone,
      roomTotal: booking.roomTotal,
      depositAmount: booking.depositAmount,
      rateSnapshot: booking.rateSnapshot,
    };
    const staysChanged =
      dto.rooms !== undefined ||
      dto.checkIn !== undefined ||
      dto.checkOut !== undefined ||
      dto.guests !== undefined;
    const pending = booking.status === BookingStatus.PendingDeposit;

    if (staysChanged) {
      const roomIds = dto.rooms
        ? dto.rooms.map((id) => new Types.ObjectId(id))
        : booking.rooms;
      let stay: StayInterval;
      try {
        stay = normalizeStay({
          checkIn: dto.checkIn ?? booking.checkIn,
          checkOut: dto.checkOut ?? booking.checkOut,
        });
      } catch (error) {
        throw new BadRequestException(
          error instanceof Error ? error.message : 'Invalid stay dates',
        );
      }
      const guests = dto.guests ?? booking.guests;
      const { roomTotal, rates } = await this.priceRooms(roomIds, guests, stay);
      await this.assertRoomsFree(roomIds, stay, this.clock.now(), booking._id);

      booking.rooms = roomIds;
      booking.checkIn = stay.checkIn;
      booking.checkOut = stay.checkOut;
      booking.guests = guests;
      booking.roomTotal = roomTotal;
      booking.rateSnapshot = rates;
      if (pending) {
        booking.depositAmount = Math.round(roomTotal * DEPOSIT_RATE);
      }
    }
    if (dto.guestName !== undefined) booking.guestName = dto.guestName.trim();
    if (dto.guestEmail !== undefined)
      booking.guestEmail = dto.guestEmail.trim();
    if (dto.guestPhone !== undefined)
      booking.guestPhone = dto.guestPhone.trim();
    await booking.save();

    if (staysChanged) {
      const hold = pending
        ? await this.holds.findOneAndUpdate(
            { booking: booking._id, isActive: true },
            {
              $set: {
                rooms: booking.rooms,
                checkIn: booking.checkIn,
                checkOut: booking.checkOut,
              },
            },
            { returnDocument: 'after' },
          )
        : null;
      // Hai thao tác đổi cùng phòng/ngày cùng lúc: bên có _id nhỏ hơn thắng; bên thua hoàn tác.
      const stay = { checkIn: booking.checkIn, checkOut: booking.checkOut };
      const lost = hold
        ? !(await this.wonTheRace(
            hold._id,
            booking.rooms,
            stay,
            this.clock.now(),
          ))
        : await this.lostConfirmedRace(booking._id, booking.rooms, stay);
      if (lost) {
        await this.bookings.updateOne({ _id: booking._id }, { $set: previous });
        if (hold) {
          await this.holds.updateOne(
            { _id: hold._id },
            {
              $set: {
                rooms: previous.rooms,
                checkIn: previous.checkIn,
                checkOut: previous.checkOut,
              },
            },
          );
        }
        throw new ConflictException(
          'One or more rooms were just taken; please choose again',
        );
      }
    }

    return {
      id: String(booking._id),
      code: booking.code,
      status: booking.status,
      rooms: booking.rooms.map(String),
      checkIn: booking.checkIn.toISOString(),
      checkOut: booking.checkOut.toISOString(),
      guests: booking.guests,
      guestName: booking.guestName,
      guestEmail: booking.guestEmail,
      guestPhone: booking.guestPhone,
      roomTotal: booking.roomTotal,
      depositAmount: booking.depositAmount,
    };
  }

  /**
   * Huỷ booking (chủ booking, nhân viên, hoặc Guest kèm mã): nhả RoomHold đang giữ và
   * chuyển sang CANCELLED. Chỉ cho huỷ khi PENDING_DEPOSIT hoặc CONFIRMED (trước check-in);
   * không tự động hoàn tiền (xử lý thủ công/ngoài phạm vi).
   */
  async cancel(bookingId: string, actor: BookingActor) {
    if (!/^[a-f\d]{24}$/i.test(bookingId)) {
      throw new BadRequestException('Invalid booking ID');
    }
    const booking = await this.bookings.findById(bookingId);
    if (!booking || !booking.isActive) {
      throw new NotFoundException('Booking not found');
    }
    authorizeBookingAccess(booking, actor);
    if (
      ![BookingStatus.PendingDeposit, BookingStatus.Confirmed].includes(
        booking.status,
      )
    ) {
      throw new ConflictException(
        'Only a pending or confirmed booking can be cancelled',
      );
    }
    booking.status = BookingStatus.Cancelled;
    booking.cancelledAt = this.clock.now();
    await booking.save();
    await this.holds.updateMany(
      { booking: booking._id, isActive: true },
      { $set: { isActive: false } },
    );
    return {
      id: String(booking._id),
      code: booking.code,
      status: booking.status,
      cancelledAt: booking.cancelledAt.toISOString(),
    };
  }

  /** Giá server-side: tổng basePrice các phòng × số đêm. Cũng xác thực phòng đặt được. */
  private async priceRooms(
    roomIds: Types.ObjectId[],
    guests: number,
    stay: StayInterval,
  ): Promise<{ roomTotal: number; rates: RoomRate[] }> {
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
    const rates: RoomRate[] = [];
    for (const room of rows) {
      if (!room.isActive || room.status === RoomStatus.Maintenance) {
        throw new ConflictException(`Room ${room._id} is not bookable`);
      }
      if (!room.roomType || !room.roomType.isActive) {
        throw new ConflictException(`Room ${room._id} has no active room type`);
      }
      capacity += room.roomType.adultCapacity + room.roomType.childCapacity;
      perNight += room.roomType.basePrice;
      rates.push({ room: room._id, ratePerNight: room.roomType.basePrice });
    }
    if (guests > capacity) {
      throw new BadRequestException(
        'Selected rooms cannot hold the party size',
      );
    }
    return { roomTotal: perNight * nights, rates };
  }

  /** Chặn trước nếu phòng đã bị booking chắc chắn hoặc hold còn hiệu lực chiếm. */
  private async assertRoomsFree(
    roomIds: Types.ObjectId[],
    stay: StayInterval,
    now: Date,
    excludeBookingId?: Types.ObjectId,
  ): Promise<void> {
    if (
      await this.hasConflict(
        roomIds,
        stay,
        now,
        undefined,
        undefined,
        excludeBookingId,
      )
    ) {
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
    excludeBookingId?: Types.ObjectId,
  ): Promise<boolean> {
    const blocking = await this.bookings
      .find({
        rooms: { $in: roomIds },
        isActive: true,
        status: { $in: [BookingStatus.Confirmed, BookingStatus.CheckedIn] },
        ...(excludeBookingId ? { _id: { $ne: excludeBookingId } } : {}),
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
    if (excludeBookingId) holdFilter.booking = { $ne: excludeBookingId };
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

  private async lostConfirmedRace(
    bookingId: Types.ObjectId,
    roomIds: Types.ObjectId[],
    stay: StayInterval,
  ): Promise<boolean> {
    const earlier = await this.bookings
      .find({
        _id: { $lt: bookingId },
        rooms: { $in: roomIds },
        isActive: true,
        status: { $in: [BookingStatus.Confirmed, BookingStatus.CheckedIn] },
      })
      .select('checkIn checkOut')
      .lean()
      .exec();
    return earlier.some((record) => this.conflicts(stay, record));
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
    extra: {
      roomTotal: number;
      rates: RoomRate[];
      customer?: Types.ObjectId;
      createdBy?: Types.ObjectId;
      status?: BookingStatus;
    },
  ) {
    // Cọc = 30% tiền phòng (placeholder chờ SRS), làm tròn về VND nguyên.
    const depositAmount = Math.round(extra.roomTotal * DEPOSIT_RATE);
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        return await this.bookings.create({
          code: this.newBookingCode(),
          ...(extra.customer ? { customer: extra.customer } : {}),
          ...(extra.createdBy ? { createdBy: extra.createdBy } : {}),
          guestName: dto.guestName.trim(),
          guestEmail: dto.guestEmail.trim(),
          guestPhone: dto.guestPhone.trim(),
          rooms: roomIds,
          checkIn: stay.checkIn,
          checkOut: stay.checkOut,
          guests: dto.guests,
          status: extra.status ?? BookingStatus.PendingDeposit,
          roomTotal: extra.roomTotal,
          depositAmount,
          rateSnapshot: extra.rates,
        });
      } catch (error) {
        if ((error as { code?: number }).code === 11000 && attempt < 4)
          continue;
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
