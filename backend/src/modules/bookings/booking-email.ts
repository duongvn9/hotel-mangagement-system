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

/** Dữ liệu tối thiểu của booking để soạn email lúc nhận/trả phòng. */
export interface StayEmailData {
  code: string;
  guestName?: string;
  guestEmail?: string;
  checkIn: Date;
  checkOut: Date;
}

/** Email xác nhận nhận phòng (CHECK_IN_CONFIRMATION). Trả null nếu thiếu email. */
export function checkInConfirmationEmail(
  booking: StayEmailData,
  roomNumbers: readonly string[],
): NotificationInput | null {
  if (!booking.guestEmail) return null;
  return {
    to: booking.guestEmail,
    template: 'CHECK_IN_CONFIRMATION',
    data: {
      bookingCode: booking.code,
      guestName: booking.guestName ?? '',
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
      roomsSummary: `Phòng ${roomNumbers.join(', ')}`,
    },
  };
}

/** Email hóa đơn lúc trả phòng (CHECK_OUT_RECEIPT). Trả null nếu thiếu email. */
export function checkOutReceiptEmail(
  booking: Pick<StayEmailData, 'code' | 'guestName' | 'guestEmail'>,
  invoice: {
    roomTotal: number;
    serviceTotal: number;
    additionalTotal: number;
    totalAmount: number;
    depositPaid: number;
    finalPaid: number;
  },
  checkedOutAt: Date,
): NotificationInput | null {
  if (!booking.guestEmail) return null;
  return {
    to: booking.guestEmail,
    template: 'CHECK_OUT_RECEIPT',
    data: {
      bookingCode: booking.code,
      guestName: booking.guestName ?? '',
      checkedOutAt,
      roomTotal: invoice.roomTotal,
      serviceTotal: invoice.serviceTotal,
      additionalTotal: invoice.additionalTotal,
      totalAmount: invoice.totalAmount,
      depositPaid: invoice.depositPaid,
      finalPaid: invoice.finalPaid,
    },
  };
}
