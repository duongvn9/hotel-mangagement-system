import type { Types } from 'mongoose';
import { BookingSource } from '../../common/constants/booking-source.enum.js';
import type { BookingListItem } from './dto/list-bookings.dto.js';

export interface PopulatedListRoom {
  _id: Types.ObjectId;
  roomNumber?: string;
  roomType?: { name?: string } | null;
}

/** Populate để lấy số phòng và tên loại phòng cho dòng booking (UC10, UC15). */
export const BOOKING_ROOMS_POPULATE = {
  path: 'rooms',
  select: 'roomNumber roomType',
  populate: { path: 'roomType', select: 'name' },
} as const;

export interface ListableBooking {
  _id: Types.ObjectId;
  code: string;
  status: string;
  guestName?: string | undefined;
  guestEmail?: string | undefined;
  guestPhone?: string | undefined;
  rooms: PopulatedListRoom[];
  checkIn: Date;
  checkOut: Date;
  adultCount: number;
  childCount: number;
  source: BookingSource;
  roomTotal: number;
  createdBy?: Types.ObjectId | undefined;
  createdAt?: Date | undefined;
}

/** Dòng booking dùng chung cho danh sách booking (UC10) và danh sách đến/đi trong ngày (UC15). */
export function toBookingListItem(booking: ListableBooking): BookingListItem {
  return {
    id: String(booking._id),
    code: booking.code,
    status: booking.status,
    guestName: booking.guestName,
    guestEmail: booking.guestEmail,
    guestPhone: booking.guestPhone,
    rooms: booking.rooms.map((room) => ({
      id: String(room._id),
      ...(room.roomNumber ? { roomNumber: room.roomNumber } : {}),
      ...(room.roomType?.name ? { roomTypeName: room.roomType.name } : {}),
    })),
    checkIn: booking.checkIn.toISOString(),
    checkOut: booking.checkOut.toISOString(),
    adultCount: booking.adultCount,
    childCount: booking.childCount,
    source: booking.source,
    roomTotal: booking.roomTotal,
    createdAt: (booking.createdAt ?? booking.checkIn).toISOString(),
    walkIn: booking.createdBy !== undefined,
  };
}
