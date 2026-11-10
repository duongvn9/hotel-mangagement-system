import type { BookingStatus } from '../../common/constants/booking-status.enum.js';
import type { PaymentPurpose } from '../payments/schemas/payment-transaction.schema.js';

export type NotificationTemplate =
  | 'BOOKING_CONFIRMATION'
  | 'PAYMENT_SUCCESS'
  | 'BOOKING_CANCELLATION'
  | 'CHECK_IN_CONFIRMATION'
  | 'CHECK_OUT_RECEIPT';
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
export type NotificationInput = { to: string } & (
  | { template: 'BOOKING_CONFIRMATION'; data: BookingConfirmationData }
  | { template: 'PAYMENT_SUCCESS'; data: PaymentSuccessData }
  | { template: 'BOOKING_CANCELLATION'; data: BookingCancellationData }
  | { template: 'CHECK_IN_CONFIRMATION'; data: CheckInConfirmationData }
  | { template: 'CHECK_OUT_RECEIPT'; data: CheckOutReceiptData }
);
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
}
export interface NotificationTransport {
  send(message: NotificationMessage, signal: AbortSignal): Promise<void>;
}
export const NOTIFICATION_TRANSPORT = Symbol('NOTIFICATION_TRANSPORT');
