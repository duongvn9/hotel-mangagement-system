import { BookingStatus } from '../../common/constants/booking-status.enum.js';
import { RoomStatus } from '../../common/constants/room-status.enum.js';
import { businessBoundary } from './availability.core.js';

const MS_PER_DAY = 86_400_000;

export enum Occupancy {
  Free = 'FREE',
  Held = 'HELD',
  Reserved = 'RESERVED',
  InHouse = 'IN_HOUSE',
}

export interface BoardRoom {
  id: string;
  roomNumber: string;
  floor: number;
  roomTypeId: string;
  roomTypeName: string;
  capacity: number;
  status: RoomStatus;
}

export interface BoardBooking {
  code: string;
  status: BookingStatus;
  guestName?: string | undefined;
  rooms: readonly string[];
  checkIn: Date;
  checkOut: Date;
}

export interface BoardBookingSummary {
  code: string;
  guestName?: string | undefined;
  status: BookingStatus;
  checkIn: string;
  checkOut: string;
}

export interface BoardRoomEntry extends BoardRoom {
  occupancy: Occupancy;
  /** Trạng thái vật lý đáng hiển thị cho ngày đang xem, null nếu không có gì đặc biệt. */
  physicalStatus: RoomStatus | null;
  booking: BoardBookingSummary | null;
}

export interface BoardSummary {
  total: number;
  /** Phòng không bị chiếm trong ngày và không bảo trì. */
  free: number;
  held: number;
  reserved: number;
  inHouse: number;
  maintenance: number;
  cleaning: number;
}

export interface RoomStatusBoard {
  date: string;
  summary: BoardSummary;
  rooms: BoardRoomEntry[];
}

export interface BoardInput {
  /** Ngày làm việc YYYY-MM-DD (giờ Việt Nam). */
  date: string;
  /** Ngày đang xem có phải hôm nay không (trạng thái vật lý chỉ có nghĩa với hôm nay). */
  isToday: boolean;
  rooms: readonly BoardRoom[];
  /** Booking chạm ngày đang xem (đã lọc trạng thái hoạt động ở nơi gọi). */
  bookings: readonly BoardBooking[];
  /** Mã booking PENDING_DEPOSIT có RoomHold còn hiệu lực. */
  liveHoldCodes: ReadonlySet<string>;
}

/** Ngày làm việc (YYYY-MM-DD, giờ Việt Nam) của một mốc thời gian. */
export function businessDay(instant: Date): string {
  return new Date(instant.getTime() + 7 * 3_600_000).toISOString().slice(0, 10);
}

const PRIORITY: Record<Occupancy, number> = {
  [Occupancy.Free]: 0,
  [Occupancy.Held]: 1,
  [Occupancy.Reserved]: 2,
  [Occupancy.InHouse]: 3,
};

function occupancyOf(
  booking: BoardBooking,
  liveHoldCodes: ReadonlySet<string>,
): Occupancy {
  switch (booking.status) {
    case BookingStatus.CheckedIn:
      return Occupancy.InHouse;
    case BookingStatus.Confirmed:
      return Occupancy.Reserved;
    case BookingStatus.RoomHeld:
    case BookingStatus.PendingDeposit:
      return liveHoldCodes.has(booking.code) ? Occupancy.Held : Occupancy.Free;
    default:
      return Occupancy.Free;
  }
}

function physicalStatusOf(
  status: RoomStatus,
  isToday: boolean,
): RoomStatus | null {
  if (status === RoomStatus.Maintenance) return status;
  if (isToday && status !== RoomStatus.Available) return status;
  return null;
}

/**
 * UC13: trạng thái từng phòng trong một ngày. Một booking chiếm phòng trong ngày D khi
 * checkIn ≤ D < checkOut (cùng quy ước với tìm phòng trống). Nếu nhiều booking chạm cùng
 * ngày thì lấy mức chiếm cao nhất: đang ở > đã xác nhận > đang giữ chỗ.
 */
export function buildRoomStatusBoard(input: BoardInput): RoomStatusBoard {
  const dayStart = businessBoundary(input.date);
  const dayEnd = new Date(dayStart.getTime() + MS_PER_DAY);

  const rooms = [...input.rooms]
    .sort(
      (a, b) =>
        a.floor - b.floor ||
        a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true }),
    )
    .map((room): BoardRoomEntry => {
      let occupancy = Occupancy.Free;
      let current: BoardBooking | null = null;
      for (const booking of input.bookings) {
        if (!booking.rooms.includes(room.id)) continue;
        if (!(booking.checkIn < dayEnd && booking.checkOut > dayStart))
          continue;
        const level = occupancyOf(booking, input.liveHoldCodes);
        if (PRIORITY[level] > PRIORITY[occupancy]) {
          occupancy = level;
          current = booking;
        }
      }
      return {
        ...room,
        occupancy,
        physicalStatus: physicalStatusOf(room.status, input.isToday),
        booking: current && {
          code: current.code,
          guestName: current.guestName,
          status: current.status,
          checkIn: current.checkIn.toISOString(),
          checkOut: current.checkOut.toISOString(),
        },
      };
    });

  const count = (predicate: (entry: BoardRoomEntry) => boolean) =>
    rooms.filter(predicate).length;
  const maintenance = (entry: BoardRoomEntry) =>
    entry.physicalStatus === RoomStatus.Maintenance;
  return {
    date: input.date,
    summary: {
      total: rooms.length,
      free: count(
        (entry) => entry.occupancy === Occupancy.Free && !maintenance(entry),
      ),
      held: count((entry) => entry.occupancy === Occupancy.Held),
      reserved: count((entry) => entry.occupancy === Occupancy.Reserved),
      inHouse: count((entry) => entry.occupancy === Occupancy.InHouse),
      maintenance: count(maintenance),
      cleaning: count((entry) => entry.physicalStatus === RoomStatus.Cleaning),
    },
    rooms,
  };
}
