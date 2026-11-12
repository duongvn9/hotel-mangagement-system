import { BookingStatus } from '../../common/constants/booking-status.enum.js';
import type { NotificationInput } from '../notifications/notification.types.js';

/** Dữ liệu tối thiểu để soạn email xác nhận/mã booking. */
export interface BookingEmailData {
  bookingId?: string;
  room?: string;
  rooms?: string[];
  nights?: number;
  guests?: number;
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
  return {
    to: booking.guestEmail,
    relatedBookingId: booking.bookingId,
    type: 'booking-confirmed',
    data: {
      bookingCode: booking.code,
      guestName: booking.guestName ?? '',
      room: booking.room ?? `${booking.roomCount} phòng`,
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
      nights:
        booking.nights ??
        Math.max(
          1,
          Math.round(
            (booking.checkOut.getTime() - booking.checkIn.getTime()) /
              (24 * 60 * 60 * 1000),
          ),
        ),
      guests: booking.guests ?? 1,
      total: booking.roomTotal,
      depositStatus:
        booking.status === BookingStatus.PendingDeposit ? 'pending' : 'paid',
      depositAmount: booking.depositAmount,
    },
  };
}
