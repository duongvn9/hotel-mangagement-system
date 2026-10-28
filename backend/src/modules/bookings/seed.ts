import { Logger } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { type Model, Types } from 'mongoose';
import { toBusinessDate } from '../../common/database/conventions.js';
import type { Seed } from '../../database/seed.js';
import { RoomType } from '../room-types/schemas/room-type.schema.js';
import { Room } from '../rooms/schemas/room.schema.js';
import { User } from '../users/schemas/user.schema.js';
import { DEPOSIT_RATE } from './bookings.service.js';
import { Booking, BookingStatus } from './schemas/booking.schema.js';

const MS_PER_DAY = 86_400_000;

/** Giờ nhận/trả phòng mẫu theo giờ Việt Nam, ghép với ngày nghiệp vụ `YYYY-MM-DD`. */
const at = (day: string, time: string) => new Date(`${day}T${time}:00+07:00`);
const addDays = (day: string, days: number) =>
  toBusinessDate(new Date(at(day, '12:00').getTime() + days * MS_PER_DAY));

export interface SampleBooking {
  code: string;
  roomNumber: string;
  /** Ngày nhận phòng `YYYY-MM-DD`; CHECKED_IN tính từ ngày chạy seed. */
  checkInDay: string;
  nights: number;
  status: BookingStatus.CheckedIn | BookingStatus.CheckedOut;
}

/**
 * Booking mẫu của customer@hms.local:
 * - `SEED-CHECKED-IN-001` đang ở phòng 101 (OCCUPIED trong seed rooms), từ hôm chạy seed
 *   thêm 2 đêm: dùng để thử Service Order, Report Issue, check-out.
 * - `SEED-CHECKED-OUT-00x` đã trả phòng: là lần lưu trú mà phản hồi mẫu (UC40, UC41) gắn vào.
 */
export const sampleBookings = (today = toBusinessDate()): SampleBooking[] => [
  {
    code: 'SEED-CHECKED-IN-001',
    roomNumber: '101',
    checkInDay: today,
    nights: 2,
    status: BookingStatus.CheckedIn,
  },
  {
    code: 'SEED-CHECKED-OUT-001',
    roomNumber: '102',
    checkInDay: '2026-09-05',
    nights: 2,
    status: BookingStatus.CheckedOut,
  },
  {
    code: 'SEED-CHECKED-OUT-002',
    roomNumber: '102',
    checkInDay: '2026-09-18',
    nights: 3,
    status: BookingStatus.CheckedOut,
  },
  {
    code: 'SEED-CHECKED-OUT-003',
    roomNumber: '301',
    checkInDay: '2026-10-02',
    nights: 2,
    status: BookingStatus.CheckedOut,
  },
];

export const seedBookings: Seed = async (app) => {
  const users = app.get<Model<User>>(getModelToken(User.name));
  const rooms = app.get<Model<Room>>(getModelToken(Room.name));
  const bookings = app.get<Model<Booking>>(getModelToken(Booking.name));
  const customer = await users
    .findOne({ email: 'customer@hms.local', isActive: true })
    .lean();
  if (!customer) {
    Logger.log('Skipping bookings: sample customer is missing', 'Seed');
    return;
  }

  for (const sample of sampleBookings()) {
    const room = await rooms
      .findOne({ roomNumber: sample.roomNumber, isActive: true })
      .populate<{ roomType: RoomType | null }>('roomType', 'basePrice')
      .lean();
    if (!room?.roomType || !(room._id instanceof Types.ObjectId)) {
      Logger.log(
        `Skipping booking ${sample.code}: active room ${sample.roomNumber} is missing`,
        'Seed',
      );
      continue;
    }
    const ratePerNight = room.roomType.basePrice;
    const roomTotal = ratePerNight * sample.nights;
    const checkOutDay = addDays(sample.checkInDay, sample.nights);
    const checkIn = at(sample.checkInDay, '14:00');
    const checkOut = at(checkOutDay, '12:00');
    const doc = new bookings({
      code: sample.code,
      customer: customer._id,
      guestName: customer.fullName,
      guestEmail: customer.email,
      guestPhone: customer.phone || '0900000000',
      rooms: [room._id],
      rateSnapshot: [{ room: room._id, ratePerNight }],
      checkIn,
      checkOut,
      checkedInAt: checkIn,
      checkedOutAt:
        sample.status === BookingStatus.CheckedOut ? checkOut : undefined,
      adultCount: 1,
      childCount: 0,
      status: sample.status,
      roomTotal,
      depositAmount: Math.round(roomTotal * DEPOSIT_RATE),
    });
    await doc.validate();
    const { _id, ...data } = doc.toObject();
    await bookings.updateOne(
      { code: sample.code },
      { $setOnInsert: data },
      { upsert: true },
    );
  }
};
