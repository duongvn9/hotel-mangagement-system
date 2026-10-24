import type { BookingStatus } from '../../common/constants/booking-status.enum.js';
import type { PaymentPurpose } from '../payments/schemas/payment-transaction.schema.js';

export type NotificationTemplate =
  'BOOKING_CONFIRMATION' | 'PAYMENT_SUCCESS' | 'BOOKING_CANCELLATION';
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
export type NotificationInput = { to: string } & (
  | { template: 'BOOKING_CONFIRMATION'; data: BookingConfirmationData }
  | { template: 'PAYMENT_SUCCESS'; data: PaymentSuccessData }
  | { template: 'BOOKING_CANCELLATION'; data: BookingCancellationData }
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
