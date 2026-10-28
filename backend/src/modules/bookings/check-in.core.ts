import { BookingStatus } from '../../common/constants/booking-status.enum.js';
import { RoomStatus } from '../../common/constants/room-status.enum.js';
import { businessDay } from './room-status-board.core.js';

export interface RoomReplacement {
  from: string;
  to: string;
}

export interface ReadinessRoom {
  roomNumber: string;
  isActive: boolean;
  status: RoomStatus;
}

export interface NotReadyRoom {
  roomNumber: string;
  reason: string;
}

/** Lý do booking không check-in được, null nếu đang CONFIRMED. */
export function checkInStatusError(status: BookingStatus): string | null {
  switch (status) {
    case BookingStatus.Confirmed:
      return null;
    case BookingStatus.PendingDeposit:
      return 'Booking has not been deposited yet';
    case BookingStatus.CheckedIn:
      return 'Booking is already checked in';
    default:
      return 'This booking cannot be checked in';
  }
}

/**
 * Cho nhận phòng từ ngày nhận (giờ Việt Nam) đến trước ngày trả phòng: khách đến muộn trong
 * thời gian ở vẫn nhận được, đến sớm hơn ngày đặt hoặc quá ngày trả thì không.
 */
export function checkInWindowError(
  today: string,
  checkIn: Date,
  checkOut: Date,
): string | null {
  const arrival = businessDay(checkIn);
  if (today < arrival) {
    return `Too early to check in: arrival date is ${arrival}`;
  }
  if (today >= businessDay(checkOut)) {
    return 'The booked stay has already ended';
  }
  return null;
}

/** Phòng chưa sẵn sàng đón khách: không hoạt động hoặc trạng thái vật lý khác AVAILABLE. */
export function notReadyRooms(rooms: readonly ReadinessRoom[]): NotReadyRoom[] {
  return rooms
    .filter((room) => !room.isActive || room.status !== RoomStatus.Available)
    .map((room) => ({
      roomNumber: room.roomNumber,
      reason: room.isActive ? room.status : 'INACTIVE',
    }));
}

export function describeNotReady(rooms: readonly NotReadyRoom[]): string {
  return `Rooms not ready: ${rooms
    .map((room) => `${room.roomNumber} (${room.reason})`)
    .join(', ')}`;
}

/** Kiểm tra hình dạng danh sách đổi phòng, null nếu hợp lệ. */
export function replacementShapeError(
  current: readonly string[],
  replacements: readonly RoomReplacement[],
): string | null {
  const froms = new Set<string>();
  const tos = new Set<string>();
  for (const { from, to } of replacements) {
    if (!current.includes(from)) {
      return `Room ${from} is not part of this booking`;
    }
    if (current.includes(to)) {
      return `Room ${to} is already part of this booking`;
    }
    if (froms.has(from) || tos.has(to)) {
      return 'A room cannot be used more than once in the replacements';
    }
    froms.add(from);
    tos.add(to);
  }
  return null;
}

export function applyReplacements(
  current: readonly string[],
  replacements: readonly RoomReplacement[],
): string[] {
  const swap = new Map(replacements.map(({ from, to }) => [from, to]));
  return current.map((room) => swap.get(room) ?? room);
}
