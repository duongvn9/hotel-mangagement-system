import type { BookingStatus } from '../../common/constants/booking-status.enum.js';
import type { PaymentPurpose } from '../payments/schemas/payment-transaction.schema.js';

export type NotificationTemplate =
  | 'BOOKING_CONFIRMATION'
  | 'PAYMENT_SUCCESS'
  | 'BOOKING_CANCELLATION'
  | 'CHECK_IN_CONFIRMATION'
  | 'CHECK_OUT_RECEIPT'
  | 'booking-confirmed'
  | 'deposit-paid'
  | 'final-payment-paid'
  | 'booking-cancelled';
export type NotificationDate = Date | string;
interface GuestData {
  bookingCode: string;
  guestName: string;
}
interface StayData extends GuestData {
  checkIn: NotificationDate;
  checkOut: NotificationDate;
}
export interface BookingConfirmationData extends StayData {
  roomsSummary: string;
  roomTotal: number;
  depositAmount: number;
  bookingStatus: BookingStatus.PendingDeposit | BookingStatus.Confirmed;
}
export interface PaymentSuccessData extends GuestData {
  amount: number;
  purpose: PaymentPurpose;
  paidAt: NotificationDate;
  transactionRef: string;
}
export interface BookingCancellationData extends StayData {
  cancelledAt: NotificationDate;
}
export interface CheckInConfirmationData extends StayData {
  roomsSummary: string;
}
export interface CheckOutReceiptData extends GuestData {
  checkedOutAt: NotificationDate;
  roomTotal: number;
  serviceTotal: number;
  additionalTotal: number;
  totalAmount: number;
  depositPaid: number;
  finalPaid: number;
}
export interface BookingConfirmedData {
  bookingCode: string;
  guestName: string;
  room: string;
  checkIn: NotificationDate;
  checkOut: NotificationDate;
  nights: number;
  guests: number;
  total: number;
  depositStatus: 'pending' | 'paid';
  depositAmount: number;
}
export interface DepositPaidData {
  bookingCode: string;
  guestName: string;
  transactionRef: string;
  amount: number;
  paidAt: NotificationDate;
  bookingState: string;
}
export interface FinalPaymentPaidData extends DepositPaidData {
  outstandingBalance: number;
  roomCharges: number;
  serviceCharges: number;
  additionalCharges: number;
  discounts: number;
  total: number;
}
export interface BookingCancelledData extends StayData {
  cancelledAt: NotificationDate;
  refundInfo?: string;
}
export type NotificationInput = { to: string; type?: NotificationTemplate } & (
  | { template: 'BOOKING_CONFIRMATION'; data: BookingConfirmationData }
  | { template: 'PAYMENT_SUCCESS'; data: PaymentSuccessData }
  | { template: 'BOOKING_CANCELLATION'; data: BookingCancellationData }
  | { template: 'CHECK_IN_CONFIRMATION'; data: CheckInConfirmationData }
  | { template: 'CHECK_OUT_RECEIPT'; data: CheckOutReceiptData }
  | {
      template: 'booking-confirmed';
      type?: 'booking-confirmed';
      data: BookingConfirmedData;
    }
  | { template: 'deposit-paid'; type?: 'deposit-paid'; data: DepositPaidData }
  | {
      template: 'final-payment-paid';
      type?: 'final-payment-paid';
      data: FinalPaymentPaidData;
    }
  | {
      template: 'booking-cancelled';
      type?: 'booking-cancelled';
      data: BookingCancelledData;
    }
  | {
      type: 'booking-confirmed';
      template?: 'booking-confirmed';
      data: BookingConfirmedData;
    }
  | { type: 'deposit-paid'; template?: 'deposit-paid'; data: DepositPaidData }
  | {
      type: 'final-payment-paid';
      template?: 'final-payment-paid';
      data: FinalPaymentPaidData;
    }
  | {
      type: 'booking-cancelled';
      template?: 'booking-cancelled';
      data: BookingCancelledData;
    }
) & { relatedBookingId?: string; relatedPaymentId?: string };
export interface NotificationResult {
  accepted: boolean;
  reason?: string;
}
export interface NotificationMessage {
  to: string;
  template: NotificationTemplate;
  subject: string;
  html: string;
  text: string;
  notificationLogId?: string;
  notificationLogRetryCount?: number;
}
export interface NotificationTransport {
  send(message: NotificationMessage, signal: AbortSignal): Promise<void>;
}
export const NOTIFICATION_TRANSPORT = Symbol('NOTIFICATION_TRANSPORT');
