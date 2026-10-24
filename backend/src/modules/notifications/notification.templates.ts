import { isEmail } from 'class-validator';
import { BookingStatus } from '../../common/constants/booking-status.enum.js';
import {
  BUSINESS_TIMEZONE,
  isMoneyVnd,
  toBusinessDate,
} from '../../common/database/conventions.js';
import { PaymentPurpose } from '../payments/schemas/payment-transaction.schema.js';
import type {
  NotificationInput,
  NotificationMessage,
} from './notification.types.js';

export const maskRecipient = (to: string): string => {
  const at = to.lastIndexOf('@');
  // Never echo an invalid address supplied by an untyped caller.
  return at > 0 ? `${to[0]}***@${to.slice(at + 1)}` : '[invalid]';
};
const escapeHtml = (value: string): string =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[char]!,
  );
const money = (value: number): string => {
  if (typeof value !== 'number' || !isMoneyVnd(value))
    throw new Error('invalid_money');
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(value);
};
const date = (value: unknown): string => {
  let business: string;
  if (value instanceof Date && Number.isFinite(value.getTime()))
    business = toBusinessDate(value);
  else if (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  )
    business = value;
  else throw new Error('invalid_date');
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: BUSINESS_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(`${business}T00:00:00+07:00`));
};
const field = (value: unknown, header = false): string => {
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    value.length > 10000 ||
    (header && (/[\r\n]/.test(value) || value.includes(String.fromCharCode(0))))
  )
    throw new Error('invalid_field');
  return value;
};

/** Validate and render before enqueueing: queued messages cannot be mutated by callers. */
export function renderNotification(
  input: NotificationInput,
): NotificationMessage {
  if (
    !input ||
    typeof input.to !== 'string' ||
    /[\r\n]/.test(input.to) ||
    !isEmail(input.to) ||
    input.to.includes(',') ||
    input.to.includes(';')
  )
    throw new Error('invalid_recipient');
  const d = input.data;
  if (!d || typeof d !== 'object') throw new Error('invalid_data');
  const code = field(d.bookingCode, true);
  const lines: string[] = [`Xin chào ${field(d.guestName)},`];
  let subject: string;
  switch (input.template) {
    case 'BOOKING_CONFIRMATION': {
      const data = input.data;
      if (
        ![BookingStatus.PendingDeposit, BookingStatus.Confirmed].includes(
          data.bookingStatus,
        )
      )
        throw new Error('invalid_status');
      const status =
        data.bookingStatus === BookingStatus.PendingDeposit
          ? 'Đang chờ đặt cọc'
          : 'Đã xác nhận';
      subject = `${status} booking ${code}`;
      lines.push(
        `Booking ${code}: ${status}.`,
        `Nhận phòng: ${date(data.checkIn)}`,
        `Trả phòng: ${date(data.checkOut)}`,
        `Phòng: ${field(data.roomsSummary)}`,
        `Tổng tiền phòng: ${money(data.roomTotal)}`,
        `Tiền đặt cọc: ${money(data.depositAmount)}`,
      );
      break;
    }
    case 'PAYMENT_SUCCESS': {
      const data = input.data;
      if (!Object.values(PaymentPurpose).includes(data.purpose))
        throw new Error('invalid_purpose');
      subject = `Thanh toán thành công booking ${code}`;
      lines.push(
        `Booking: ${code}`,
        `Thanh toán ${data.purpose === PaymentPurpose.Deposit ? 'đặt cọc' : 'hóa đơn cuối'} thành công: ${money(data.amount)}`,
        `Ngày thanh toán: ${date(data.paidAt)}`,
        `Mã giao dịch: ${field(data.transactionRef)}`,
      );
      break;
    }
    case 'BOOKING_CANCELLATION': {
      const data = input.data;
      subject = `Đã hủy booking ${code}`;
      lines.push(
        `Booking ${code} đã được hủy.`,
        `Nhận phòng: ${date(data.checkIn)}`,
        `Trả phòng: ${date(data.checkOut)}`,
        `Ngày hủy: ${date(data.cancelledAt)}`,
      );
      break;
    }
    default:
      throw new Error('unknown_template');
  }
  lines.push('Grand Emily Hotel');
  return {
    to: input.to,
    template: input.template,
    subject,
    text: lines.join('\n'),
    html: lines.map((line) => `<p>${escapeHtml(line)}</p>`).join(''),
  };
}
