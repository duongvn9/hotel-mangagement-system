import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { randomBytes } from 'node:crypto';
import { Model, Types, type HydratedDocument } from 'mongoose';
import type { AuthUser } from '../../common/auth/auth-user.js';
import {
  authorizeBookingAccess,
  type BookingActor,
} from '../../common/auth/booking-access.js';
import { Role } from '../../common/constants/role.enum.js';
import { RoomStatus } from '../../common/constants/room-status.enum.js';
import { Room } from '../rooms/schemas/room.schema.js';
import {
  PaymentTransaction,
  PaymentPurpose,
  PaymentStatus,
} from '../payments/schemas/payment-transaction.schema.js';
import {
  Booking,
  BookingStatus,
  BookingSource,
} from './schemas/booking.schema.js';
import {
  BLOCKING_BOOKING_STATUSES,
  RELEASED_BOOKING_STATUSES,
  UNCONFIRMED_BOOKING_STATUSES,
} from '../../common/constants/booking-status.enum.js';
import { RoomHold, type RoomHoldDocument } from './schemas/room-hold.schema.js';
import { AvailabilityClock } from './availability.adapters.js';
import {
  businessBoundary,
  normalizeStay,
  overlaps,
  type StayInterval,
} from './availability.core.js';
import {
  HoldBookingDto,
  SubmitBookingDetailsDto,
} from './dto/hold-booking.dto.js';
import type { GuestSessionContext } from './guest-session.decorator.js';
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

type BookingDocument = HydratedDocument<Booking>;

/** Thời hạn giữ phòng (một cửa sổ: gồm điền form + đặt cọc; refresh không gia hạn). */
const HOLD_WINDOW_MS = 15 * 60 * 1000;
const MS_PER_DAY = 86_400_000;
/** Chống lạm dụng: tối đa số hold một phiên/IP tạo trong cửa sổ thời gian. */
const HOLD_RATE_WINDOW_MS = 30 * 60 * 1000;
const HOLD_RATE_MAX = 3;
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
    @InjectModel(PaymentTransaction.name)
    private readonly payments: Model<PaymentTransaction>,
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
      { adultCount: dto.adultCount, childCount: dto.childCount },
      stay,
    );
    const now = this.clock.now();
    await this.assertRoomsFree(roomIds, stay, now);

    // Guest/Customer đặt online; vai trò nhân viên coi như đặt hộ tại quầy.
    const source =
      user && user.role !== Role.Customer
        ? BookingSource.FrontDesk
        : BookingSource.Online;
    const booking = await this.createBookingDocument(dto, roomIds, stay, {
      roomTotal,
      rates,
      source,
      customer:
        user?.role === Role.Customer ? new Types.ObjectId(user.id) : undefined,
    });

    let hold: RoomHoldDocument;
    try {
      hold = await this.holds.create({
        booking: booking._id,
        holdToken: this.newHoldToken(),
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
      adultCount: booking.adultCount,
      childCount: booking.childCount,
      source: booking.source,
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
      { adultCount: dto.adultCount, childCount: dto.childCount },
      stay,
    );
    await this.assertRoomsFree(roomIds, stay, this.clock.now());

    const booking = await this.createBookingDocument(dto, roomIds, stay, {
      roomTotal,
      rates,
      source: BookingSource.FrontDesk,
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
      adultCount: booking.adultCount,
      childCount: booking.childCount,
      source: booking.source,
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
      adultCount: booking.adultCount,
      childCount: booking.childCount,
      source: booking.source,
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
      dto.adultCount !== undefined ||
      dto.childCount !== undefined;
    const pending = booking.status === BookingStatus.PendingDeposit;
    if (pending) {
      const hold = await this.holds.findOne({
        booking: booking._id,
        isActive: true,
        expiresAt: { $gt: this.clock.now() },
      });
      if (!hold) {
        await this.lazyExpire(booking, null, this.clock.now());
        throw new ConflictException('Hold has expired; please start again');
      }
    }
    if (
      staysChanged &&
      (await this.payments.exists({
        booking: booking._id,
        purpose: PaymentPurpose.Deposit,
        status: PaymentStatus.Pending,
        isActive: true,
      }))
    ) {
      throw new ConflictException(
        'Cannot change stay while a deposit payment is pending',
      );
    }

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
      const occupancy = {
        adultCount: dto.adultCount ?? booking.adultCount,
        childCount: dto.childCount ?? booking.childCount,
      };
      if (occupancy.adultCount < 1) {
        throw new BadRequestException('Party must include at least one adult');
      }
      const { roomTotal, rates } = await this.priceRooms(
        roomIds,
        occupancy,
        stay,
      );
      await this.assertRoomsFree(roomIds, stay, this.clock.now(), booking._id);

      booking.rooms = roomIds;
      booking.checkIn = stay.checkIn;
      booking.checkOut = stay.checkOut;
      booking.adultCount = occupancy.adultCount;
      booking.childCount = occupancy.childCount;
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
            {
              booking: booking._id,
              isActive: true,
              expiresAt: { $gt: this.clock.now() },
            },
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
      if (pending && !hold) {
        await this.bookings.updateOne({ _id: booking._id }, { $set: previous });
        throw new ConflictException('Hold has expired; please start again');
      }
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
      adultCount: booking.adultCount,
      childCount: booking.childCount,
      source: booking.source,
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
      ![
        BookingStatus.RoomHeld,
        BookingStatus.PendingDeposit,
        BookingStatus.Confirmed,
      ].includes(booking.status)
    ) {
      throw new ConflictException(
        'Only a held, pending or confirmed booking can be cancelled',
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
    occupancy: { adultCount: number; childCount: number },
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

    let adultCapacity = 0;
    let childCapacity = 0;
    let perNight = 0;
    const rates: RoomRate[] = [];
    for (const room of rows) {
      if (!room.isActive || room.status === RoomStatus.Maintenance) {
        throw new ConflictException(`Room ${room._id} is not bookable`);
      }
      if (!room.roomType || !room.roomType.isActive) {
        throw new ConflictException(`Room ${room._id} has no active room type`);
      }
      adultCapacity += room.roomType.adultCapacity;
      childCapacity += room.roomType.childCapacity;
      perNight += room.roomType.basePrice;
      rates.push({ room: room._id, ratePerNight: room.roomType.basePrice });
    }
    if (
      occupancy.adultCount > adultCapacity ||
      occupancy.childCount > childCapacity
    ) {
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
        status: { $in: BLOCKING_BOOKING_STATUSES },
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
        RELEASED_BOOKING_STATUSES.includes(parent.status)
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
      source: BookingSource;
      customer?: Types.ObjectId;
      createdBy?: Types.ObjectId;
      status?: BookingStatus;
    },
  ) {
    // Cọc = 30% tiền phòng (placeholder chờ SRS), làm tròn về VND nguyên.
    const depositAmount = Math.round(extra.roomTotal * DEPOSIT_RATE);
    return this.insertBooking({
      ...(extra.customer ? { customer: extra.customer } : {}),
      ...(extra.createdBy ? { createdBy: extra.createdBy } : {}),
      guestName: dto.guestName.trim(),
      guestEmail: dto.guestEmail.trim(),
      guestPhone: dto.guestPhone.trim(),
      rooms: roomIds,
      checkIn: stay.checkIn,
      checkOut: stay.checkOut,
      adultCount: dto.adultCount,
      childCount: dto.childCount,
      source: extra.source,
      status: extra.status ?? BookingStatus.PendingDeposit,
      roomTotal: extra.roomTotal,
      depositAmount,
      rateSnapshot: extra.rates,
    });
  }

  private async insertBooking(
    data: Record<string, unknown>,
  ): Promise<BookingDocument> {
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        return await this.bookings.create({
          code: this.newBookingCode(),
          ...data,
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

  private newHoldToken(): string {
    return randomBytes(24).toString('base64url');
  }

  // ───────────────────────── Luồng giữ phòng TO-BE ─────────────────────────

  /**
   * Cấp hold khi khách bấm "Đặt phòng": chạy chống lạm dụng + kiểm tra khả dụng,
   * tạo Booking nháp ROOM_HELD + RoomHold, khóa phòng một cửa sổ 15 phút.
   * Một phiên chỉ giữ 1 hold; bấm lại trả hold cũ, KHÔNG gia hạn.
   */
  async hold(dto: HoldBookingDto, ctx: GuestSessionContext, user?: AuthUser) {
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
    const now = this.clock.now();

    // Một hold/phiên: nếu phiên đang giữ một hold còn hạn thì trả lại chính nó.
    if (ctx.sessionId) {
      const existing = await this.holds
        .findOne({
          sessionId: ctx.sessionId,
          isActive: true,
          expiresAt: { $gt: now },
        })
        .sort({ createdAt: -1 });
      if (existing) {
        const current = await this.bookings.findById(existing.booking);
        if (
          current?.isActive &&
          UNCONFIRMED_BOOKING_STATUSES.includes(current.status)
        ) {
          return this.holdResponse(current, existing);
        }
        await this.holds.updateOne(
          { _id: existing._id },
          { $set: { isActive: false } },
        );
      }
    }

    await this.enforceHoldRate(ctx, now);

    const { roomTotal, rates } = await this.priceRooms(
      roomIds,
      { adultCount: dto.adultCount, childCount: dto.childCount },
      stay,
    );
    await this.assertRoomsFree(roomIds, stay, now);
    const source =
      user && user.role !== Role.Customer
        ? BookingSource.FrontDesk
        : BookingSource.Online;

    const booking = await this.insertBooking({
      ...(user?.role === Role.Customer
        ? { customer: new Types.ObjectId(user.id) }
        : {}),
      rooms: roomIds,
      checkIn: stay.checkIn,
      checkOut: stay.checkOut,
      adultCount: dto.adultCount,
      childCount: dto.childCount,
      source,
      status: BookingStatus.RoomHeld,
      roomTotal,
      depositAmount: Math.round(roomTotal * DEPOSIT_RATE),
      rateSnapshot: rates,
    });

    let hold: RoomHoldDocument;
    try {
      hold = await this.holds.create({
        booking: booking._id,
        holdToken: this.newHoldToken(),
        ...(ctx.sessionId ? { sessionId: ctx.sessionId } : {}),
        ...(ctx.clientIp ? { clientIp: ctx.clientIp } : {}),
        rooms: roomIds,
        checkIn: stay.checkIn,
        checkOut: stay.checkOut,
        expiresAt: new Date(now.getTime() + HOLD_WINDOW_MS),
        isActive: true,
      });
    } catch (error) {
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
    return this.holdResponse(booking, hold);
  }

  /**
   * Nhập thông tin liên hệ cho hold còn hạn: ROOM_HELD -> PENDING_DEPOSIT.
   * KHÔNG reset thời hạn giữ phòng (một cửa sổ duy nhất).
   */
  async submitDetails(dto: SubmitBookingDetailsDto) {
    const hold = await this.holds.findOne({ holdToken: dto.holdToken });
    if (!hold || !hold.isActive) {
      throw new NotFoundException('Hold not found or no longer active');
    }
    const now = this.clock.now();
    const booking = await this.bookings.findById(hold.booking);
    if (!booking || !booking.isActive) {
      throw new NotFoundException('Booking not found');
    }
    if (!(hold.expiresAt > now)) {
      await this.lazyExpire(booking, hold, now);
      throw new ConflictException('Hold has expired; please start again');
    }
    if (booking.status === BookingStatus.PendingDeposit) {
      return this.holdResponse(booking, hold); // idempotent
    }
    if (booking.status !== BookingStatus.RoomHeld) {
      throw new ConflictException('Booking is not awaiting contact details');
    }
    booking.guestName = dto.guestName.trim();
    booking.guestEmail = dto.guestEmail.trim();
    booking.guestPhone = dto.guestPhone.trim();
    // Lưu dịch vụ chọn kèm (gộp trùng theo serviceId); tự sinh đơn khi booking qua CONFIRMED.
    if (dto.serviceSelections?.length) {
      const merged = new Map<string, number>();
      for (const sel of dto.serviceSelections) {
        merged.set(
          sel.serviceId,
          (merged.get(sel.serviceId) ?? 0) + sel.quantity,
        );
      }
      booking.serviceSelections = [...merged].map(([service, quantity]) => ({
        service: new Types.ObjectId(service),
        quantity,
      }));
    }
    booking.status = BookingStatus.PendingDeposit;
    await booking.save();
    return this.holdResponse(booking, hold);
  }

  /** Đọc authoritative một booking + deadline thật từ server (thay localStorage). */
  async getBooking(
    id: string,
    ctx: { code?: string; user?: AuthUser; sessionId?: string },
  ) {
    if (!/^[a-f\d]{24}$/i.test(id)) {
      throw new BadRequestException('Invalid booking ID');
    }
    const booking = await this.bookings.findById(id);
    if (!booking || !booking.isActive) {
      throw new NotFoundException('Booking not found');
    }
    const hold = await this.holds
      .findOne({ booking: booking._id })
      .sort({ createdAt: -1 });
    this.authorizeRead(booking, hold, ctx);
    await this.lazyExpire(booking, hold, this.clock.now());
    return this.readResponse(booking, hold);
  }

  /** Nhả các hold quá hạn: chuyển booking chưa xác nhận sang EXPIRED (sweep định kỳ). */
  async sweepExpired(now: Date = this.clock.now()): Promise<number> {
    const stale = await this.holds
      .find({ isActive: true, expiresAt: { $lte: now } })
      .select('_id booking')
      .lean();
    let expired = 0;
    for (const hold of stale) {
      const result = await this.bookings.updateOne(
        {
          _id: hold.booking,
          isActive: true,
          status: { $in: UNCONFIRMED_BOOKING_STATUSES },
        },
        { $set: { status: BookingStatus.Expired } },
      );
      await this.holds.updateOne(
        { _id: hold._id },
        { $set: { isActive: false } },
      );
      if (result.modifiedCount) expired += 1;
    }
    return expired;
  }

  private async enforceHoldRate(
    ctx: GuestSessionContext,
    now: Date,
  ): Promise<void> {
    const keys: Record<string, string>[] = [];
    if (ctx.sessionId) keys.push({ sessionId: ctx.sessionId });
    if (ctx.clientIp) keys.push({ clientIp: ctx.clientIp });
    if (keys.length === 0) return;
    const since = new Date(now.getTime() - HOLD_RATE_WINDOW_MS);
    const recent = await this.holds.countDocuments({
      createdAt: { $gte: since },
      $or: keys,
    });
    if (recent >= HOLD_RATE_MAX) {
      throw new HttpException(
        'Too many booking holds from this session; please wait a few minutes',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private authorizeRead(
    booking: BookingDocument,
    hold: RoomHoldDocument | null,
    ctx: { code?: string; user?: AuthUser; sessionId?: string },
  ): void {
    if (ctx.sessionId && hold?.sessionId && ctx.sessionId === hold.sessionId) {
      return;
    }
    authorizeBookingAccess(booking, {
      ...(ctx.user ? { user: ctx.user } : {}),
      ...(ctx.code ? { code: ctx.code } : {}),
    });
  }

  private async lazyExpire(
    booking: BookingDocument,
    hold: RoomHoldDocument | null,
    now: Date,
  ): Promise<void> {
    if (!UNCONFIRMED_BOOKING_STATUSES.includes(booking.status)) return;
    const expired = !hold || !hold.isActive || !(hold.expiresAt > now);
    if (!expired) return;
    booking.status = BookingStatus.Expired;
    await booking.save();
    if (hold?.isActive) {
      hold.isActive = false;
      await hold.save();
    }
  }

  private holdResponse(booking: BookingDocument, hold: RoomHoldDocument) {
    return {
      bookingId: String(booking._id),
      holdToken: hold.holdToken,
      status: booking.status,
      rooms: booking.rooms.map(String),
      checkIn: booking.checkIn.toISOString(),
      checkOut: booking.checkOut.toISOString(),
      adultCount: booking.adultCount,
      childCount: booking.childCount,
      source: booking.source,
      roomTotal: booking.roomTotal,
      depositAmount: booking.depositAmount,
      holdExpiresAt: hold.expiresAt.toISOString(),
    };
  }

  private readResponse(
    booking: BookingDocument,
    hold: RoomHoldDocument | null,
  ) {
    const holdActive =
      hold?.isActive &&
      UNCONFIRMED_BOOKING_STATUSES.includes(booking.status) &&
      hold.expiresAt > this.clock.now();
    return {
      id: String(booking._id),
      code: booking.code,
      status: booking.status,
      rooms: booking.rooms.map(String),
      checkIn: booking.checkIn.toISOString(),
      checkOut: booking.checkOut.toISOString(),
      adultCount: booking.adultCount,
      childCount: booking.childCount,
      source: booking.source,
      roomTotal: booking.roomTotal,
      depositAmount: booking.depositAmount,
      ...(holdActive ? { holdExpiresAt: hold!.expiresAt.toISOString() } : {}),
    };
  }
}
