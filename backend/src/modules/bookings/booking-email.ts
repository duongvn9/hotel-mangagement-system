import { BookingStatus } from '../../common/constants/booking-status.enum.js';
import type { NotificationInput } from '../notifications/notification.types.js';

/** Dữ liệu tối thiểu để soạn email xác nhận/mã booking. */
export interface BookingEmailData {
  code: string;
  guestName?: string;
  guestEmail?: string;
  checkIn: Date;
  checkOut: Date;
  roomCount: number;
  roomTotal: number;
  depositAmount: number;
  status: BookingStatus;
}

/**
 * Soạn input email BOOKING_CONFIRMATION cho khách: khi PENDING_DEPOSIT là "mã đặt phòng +
 * cần đặt cọc", khi CONFIRMED là "đã xác nhận". Trả null nếu thiếu email (không gửi).
 */
export function bookingConfirmationEmail(
  booking: BookingEmailData,
): NotificationInput | null {
  if (!booking.guestEmail) return null;
  const bookingStatus =
    booking.status === BookingStatus.Confirmed
      ? BookingStatus.Confirmed
      : BookingStatus.PendingDeposit;
  return {
    to: booking.guestEmail,
    template: 'BOOKING_CONFIRMATION',
    data: {
      bookingCode: booking.code,
      guestName: booking.guestName ?? '',
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
      roomsSummary: `${booking.roomCount} phòng`,
      roomTotal: booking.roomTotal,
      depositAmount: booking.depositAmount,
      bookingStatus,
    },
  };
}
