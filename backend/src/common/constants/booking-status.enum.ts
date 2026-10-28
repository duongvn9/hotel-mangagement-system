export enum BookingStatus {
  /** Giữ phòng tạm khi khách bắt đầu đặt, trước khi nhập đủ thông tin (TO-BE). */
  RoomHeld = 'ROOM_HELD',
  PendingDeposit = 'PENDING_DEPOSIT',
  Confirmed = 'CONFIRMED',
  CheckedIn = 'CHECKED_IN',
  CheckedOut = 'CHECKED_OUT',
  Cancelled = 'CANCELLED',
  /** Hết hạn giữ phòng mà chưa xác nhận; backend chủ động chuyển, nhả phòng. */
  Expired = 'EXPIRED',
}

/** Trạng thái booking chiếm phòng chắc chắn (để tính trùng/khả dụng). */
export const BLOCKING_BOOKING_STATUSES: readonly BookingStatus[] = [
  BookingStatus.Confirmed,
  BookingStatus.CheckedIn,
];

/** Trạng thái kết thúc: hold của booking không còn giữ phòng. */
export const RELEASED_BOOKING_STATUSES: readonly BookingStatus[] = [
  BookingStatus.Cancelled,
  BookingStatus.CheckedOut,
  BookingStatus.Expired,
];

/** Booking chưa xác nhận, có thể hết hạn giữ phòng. */
export const UNCONFIRMED_BOOKING_STATUSES: readonly BookingStatus[] = [
  BookingStatus.RoomHeld,
  BookingStatus.PendingDeposit,
];
