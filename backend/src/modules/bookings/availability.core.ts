import {
  BookingStatus,
  BLOCKING_BOOKING_STATUSES,
  RELEASED_BOOKING_STATUSES,
} from '../../common/constants/booking-status.enum.js';
import { toBusinessDate } from '../../common/database/conventions.js';

import type { RoomTypeBedSummary } from './dto/room-type-overview.dto.js';

export interface AvailabilityQuery {
  checkIn: Date | string;
  checkOut: Date | string;
  guests: number;
  roomTypeId?: string;
  /** Lọc bổ sung ở tầng loại phòng (áp dụng trong nguồn phòng, không ở core). */
  bedTypeIds?: string[];
  amenityIds?: string[];
  priceMin?: number;
  priceMax?: number;
  adults?: number;
  children?: number;
}

export interface StayInterval {
  checkIn: Date;
  checkOut: Date;
}
export interface AvailableRoom {
  id: string;
  roomTypeId: string;
  capacity: number;
  /** Tên loại phòng, để hiển thị cho khách (có khi nguồn phòng cung cấp). */
  roomTypeName?: string;
  images?: string[];
  beds?: RoomTypeBedSummary[];
  /** Đơn giá mỗi đêm của loại phòng (VND). */
  pricePerNight?: number;
}
export interface AvailabilityRoom extends AvailableRoom {
  isActive: boolean;
  roomTypeActive: boolean;
  operationallyAvailable: boolean;
}
export interface AvailabilityBooking extends StayInterval {
  id: string;
  rooms: readonly string[];
  status: BookingStatus;
  isActive: boolean;
}
export interface AvailabilityHold extends StayInterval {
  bookingId: string;
  rooms: readonly string[];
  expiresAt: Date;
  isActive: boolean;
}

export function businessBoundary(value: Date | string): Date {
  let day: string;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    if (
      !Number.isFinite(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== value
    )
      throw new RangeError('Invalid date');
    day = value;
  } else {
    if (!(value instanceof Date))
      throw new RangeError('Use Date instants or YYYY-MM-DD business dates');
    if (!Number.isFinite(value.getTime())) throw new RangeError('Invalid date');
    day = toBusinessDate(value);
  }
  return new Date(`${day}T00:00:00.000+07:00`);
}

export function normalizeStay(
  input: Pick<AvailabilityQuery, 'checkIn' | 'checkOut'>,
): StayInterval {
  const checkIn = businessBoundary(input.checkIn);
  const checkOut = businessBoundary(input.checkOut);
  if (checkOut <= checkIn)
    throw new RangeError('checkOut must be after checkIn');
  return { checkIn, checkOut };
}

export function overlaps(a: StayInterval, b: StayInterval): boolean {
  return a.checkIn < b.checkOut && b.checkIn < a.checkOut;
}

export function validateQuery(query: AvailabilityQuery): StayInterval {
  if (!Number.isSafeInteger(query.guests) || query.guests < 1)
    throw new RangeError('guests must be a positive integer');
  if (
    query.roomTypeId !== undefined &&
    !/^[a-f\d]{24}$/i.test(query.roomTypeId)
  )
    throw new RangeError('Invalid roomTypeId');
  for (const [label, ids] of [
    ['bedTypeIds', query.bedTypeIds],
    ['amenityIds', query.amenityIds],
  ] as const) {
    if (ids === undefined) continue;
    if (
      !Array.isArray(ids) ||
      ids.some((id) => typeof id !== 'string' || !/^[a-f\d]{24}$/i.test(id)) ||
      new Set(ids).size !== ids.length
    )
      throw new RangeError(`Invalid ${label}`);
  }
  for (const [label, value] of [
    ['priceMin', query.priceMin],
    ['priceMax', query.priceMax],
    ['adults', query.adults],
    ['children', query.children],
  ] as const) {
    if (value === undefined) continue;
    if (!Number.isSafeInteger(value) || value < 0)
      throw new RangeError(`Invalid ${label}`);
  }
  if (
    query.priceMin !== undefined &&
    query.priceMax !== undefined &&
    query.priceMin > query.priceMax
  )
    throw new RangeError('priceMin must be <= priceMax');
  return normalizeStay(query);
}

export function calculateAvailability(
  query: AvailabilityQuery,
  rooms: readonly AvailabilityRoom[],
  bookings: readonly AvailabilityBooking[],
  holds: readonly AvailabilityHold[],
  now: Date,
): AvailableRoom[] {
  const stay = validateQuery(query);
  if (!Number.isFinite(now.getTime())) throw new RangeError('Invalid clock');
  const blocked = new Set<string>();
  const parents = new Map(bookings.map((booking) => [booking.id, booking]));
  const conflicts = (record: StayInterval): boolean => {
    try {
      return overlaps(stay, normalizeStay(record));
    } catch {
      return true;
    }
  };
  for (const booking of bookings) {
    if (
      booking.isActive &&
      BLOCKING_BOOKING_STATUSES.includes(booking.status) &&
      conflicts(booking)
    ) {
      booking.rooms.forEach((id) => blocked.add(id));
    }
  }
  for (const hold of holds) {
    if (!hold.isActive || !(hold.expiresAt > now) || !conflicts(hold)) continue;
    const parent = parents.get(hold.bookingId);
    if (
      parent &&
      (!parent.isActive || RELEASED_BOOKING_STATUSES.includes(parent.status))
    )
      continue;
    hold.rooms.forEach((id) => blocked.add(id));
  }
  const seen = new Set<string>();
  return rooms
    .filter((room) => {
      if (seen.has(room.id)) return false;
      seen.add(room.id);
      return (
        room.isActive &&
        room.roomTypeActive &&
        room.operationallyAvailable &&
        Number.isSafeInteger(room.capacity) &&
        room.capacity >= query.guests &&
        (!query.roomTypeId || room.roomTypeId === query.roomTypeId) &&
        !blocked.has(room.id)
      );
    })
    .map((room) => ({
      id: room.id,
      roomTypeId: room.roomTypeId,
      capacity: room.capacity,
      ...(room.images !== undefined ? { images: room.images } : {}),
      ...(room.beds !== undefined ? { beds: room.beds } : {}),
      // Chỉ kèm khi nguồn phòng cung cấp, giữ nguyên shape tối thiểu cho các stub/test.
      ...(room.roomTypeName !== undefined
        ? { roomTypeName: room.roomTypeName }
        : {}),
      ...(room.pricePerNight !== undefined
        ? { pricePerNight: room.pricePerNight }
        : {}),
    }));
}
