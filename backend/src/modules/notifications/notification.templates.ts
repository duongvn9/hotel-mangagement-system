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
  NotificationTemplate,
} from './notification.types.js';

export const maskRecipient = (to: string): string => {
  const at = to.lastIndexOf('@');
  // Never echo an invalid address supplied by an untyped caller.
  return at > 0 ? `${to[0]}***@${to.slice(at + 1)}` : '[invalid]';
};
export const escapeNotificationHtml = (value: string): string =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        char
      ]!,
  );
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

const modernDate = (value: unknown): string => {
  if (!(value instanceof Date) && typeof value !== 'string')
    throw new Error('invalid_date');
  const parsed = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(parsed.getTime())) throw new Error('invalid_date');
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: BUSINESS_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(parsed);
};
const modernMoney = (amount: number): string => {
  if (!isMoneyVnd(amount)) throw new Error('invalid_money');
  return `${new Intl.NumberFormat('vi-VN').format(amount)} ₫`;
};
const baseEmail = (
  title: string,
  guestName: string,
  status: 'confirmed' | 'paid' | 'cancelled',
  rows: [string, string][],
  notes: string[],
  cta: string,
  href: string,
  appearance: { logoUrl?: string; bannerUrl?: string },
): { html: string; text: string } => {
  const colors = {
    confirmed: '#0B2545',
    paid: '#16794B',
    cancelled: '#667085',
  };
  const safe = escapeNotificationHtml;
  const text = [
    `Xin chào ${guestName},`,
    title,
    ...rows.map(([label, value]) => `${label}: ${value}`),
    ...notes,
    cta,
    '---',
    'Grand Emily Hotel',
    '123 Đường Trần Phú, Phường Lộc Thọ, TP. Nha Trang, Khánh Hòa',
    'Hotline: (+84) 258 3888 999 · Email: support@grandemily.com',
    'Email này được gửi tự động.',
  ].join('\n');
  const logo = appearance.logoUrl
    ? `<img src="${safe(appearance.logoUrl)}" alt="Grand Emily Hotel" style="display:block;max-height:48px;max-width:180px"/>`
    : '<div style="font:bold 18px \'Cinzel\',Georgia,serif;letter-spacing:2px;color:#0B2545">GRAND EMILY HOTEL</div>';
  const banner = appearance.bannerUrl
    ? `<tr><td><img src="${safe(appearance.bannerUrl)}" alt="Grand Emily Hotel" width="600" style="display:block;width:100%;height:auto"/></td></tr>`
    : '';
  const html = `<!doctype html><html><body style="margin:0;background:#F4F4F4;color:#0B2545;font:14px/1.6 Arial,Helvetica,sans-serif"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F4F4F4"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#fff;border-radius:12px;overflow:hidden"><tr><td style="padding:22px 28px;border-bottom:1px solid #eee;font-weight:bold;color:#0B2545">${logo}</td></tr>${banner}<tr><td style="padding:28px;background:${colors[status]};color:#fff"><div style="font:bold 24px Georgia,serif;letter-spacing:-0.5px">${safe(title)}</div><div style="padding-top:6px;font-size:14px;opacity:0.9">Grand Emily Hotel</div></td></tr><tr><td style="padding:24px 28px"><p>Xin chào ${safe(guestName)},</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse">${rows.map(([label, value]) => `<tr><td style="padding:10px 8px;border-bottom:1px solid #eee;color:#667085">${safe(label)}</td><td style="padding:10px 8px;border-bottom:1px solid #eee;text-align:right;font-weight:600;color:#0B2545">${safe(value)}</td></tr>`).join('')}</table>${notes.map((note) => `<p style="color:#475467;margin-top:14px">${safe(note)}</p>`).join('')}<p style="margin:24px 0"><a href="${safe(href)}" style="display:inline-block;min-height:44px;line-height:44px;padding:0 24px;background:#0B2545;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;border-radius:6px;text-align:center">${safe(cta)}</a></p></td></tr><tr><td style="padding:22px 28px;background:#F8F8F8;color:#667085;font-size:13px;line-height:1.6;border-top:1px solid #eee"><div style="font-weight:700;color:#0B2545;margin-bottom:4px">Grand Emily Hotel</div><div>123 Đường Trần Phú, Phường Lộc Thọ, TP. Nha Trang, Khánh Hòa</div><div>Hotline: <a href="tel:+842583888999" style="color:#0B2545;text-decoration:none;font-weight:600">(+84) 258 3888 999</a> · Email: <a href="mailto:support@grandemily.com" style="color:#0B2545;text-decoration:none;font-weight:600">support@grandemily.com</a></div><div style="margin-top:6px;font-size:12px;color:#98A2B3">Email này được gửi tự động, vui lòng không trả lời trực tiếp.</div></td></tr></table></td></tr></table></body></html>`;
  return { html, text };
};

function renderModern(
  input: NotificationInput,
  appearance: { logoUrl?: string; bannerUrl?: string; appBaseUrl?: string },
): NotificationMessage | null {
  const kind = input.template ?? input.type;
  if (!kind || !kind.includes('-')) return null;
  const data = input.data as unknown as Record<string, unknown>;
  const code = field(data.bookingCode, true);
  const guestName = field(data.guestName);
  let title = '';
  let status: 'confirmed' | 'paid' | 'cancelled' = 'confirmed';
  let rows: [string, string][] = [['Mã đặt phòng', code]];
  const notes: string[] = [];
  let cta = 'Xem đặt phòng';
  switch (kind) {
    case 'booking-confirmed': {
      title = 'Xác nhận đặt phòng';
      const d =
        data as unknown as import('./notification.types.js').BookingConfirmedData;
      if (
        !Number.isSafeInteger(d.nights) ||
        d.nights < 1 ||
        !Number.isSafeInteger(d.guests) ||
        d.guests < 1
      )
        throw new Error('invalid_stay');
      rows.push(
        ['Phòng / loại phòng', field(d.room)],
        ['Nhận phòng', modernDate(d.checkIn)],
        ['Trả phòng', modernDate(d.checkOut)],
        ['Số đêm', `${d.nights}`],
        ['Số khách', `${d.guests}`],
        ['Tổng tiền', modernMoney(d.total)],
        [
          'Đặt cọc',
          d.depositStatus === 'paid' ? 'Đã thanh toán' : 'Chưa thanh toán',
        ],
      );
      if (d.depositStatus === 'pending')
        notes.push(
          `Vui lòng thanh toán tiền đặt cọc ${modernMoney(d.depositAmount)} để hoàn tất đặt phòng.`,
        );
      break;
    }
    case 'deposit-paid': {
      title = 'Thanh toán đặt cọc thành công';
      status = 'paid';
      rows.push(
        ['Mã giao dịch VNPay', field(data.transactionRef, true)],
        ['Số tiền', modernMoney(data.amount as number)],
        ['Thời gian thanh toán', modernDate(data.paidAt)],
        ['Trạng thái đặt phòng', field(data.bookingState)],
      );
      break;
    }
    case 'final-payment-paid': {
      title = 'Thanh toán hóa đơn thành công';
      status = 'paid';
      cta = 'Xem hóa đơn';
      rows.push(
        ['Mã giao dịch VNPay', field(data.transactionRef, true)],
        ['Đã thanh toán', modernMoney(data.amount as number)],
        ['Thời gian thanh toán', modernDate(data.paidAt)],
        ['Số dư còn lại', modernMoney(data.outstandingBalance as number)],
        ['Tiền phòng', modernMoney(data.roomCharges as number)],
        ['Dịch vụ', modernMoney(data.serviceCharges as number)],
        ['Phụ thu', modernMoney(data.additionalCharges as number)],
        ['Giảm giá', modernMoney(data.discounts as number)],
        ['Tổng hóa đơn', modernMoney(data.total as number)],
      );
      break;
    }
    case 'booking-cancelled': {
      title = 'Đặt phòng đã được hủy';
      status = 'cancelled';
      cta = 'Đặt phòng lại';
      rows.push(
        ['Nhận phòng', modernDate(data.checkIn)],
        ['Trả phòng', modernDate(data.checkOut)],
        ['Thời gian hủy', modernDate(data.cancelledAt)],
      );
      if (typeof data.refundInfo === 'string' && data.refundInfo.trim())
        rows.push(['Thông tin hoàn tiền', field(data.refundInfo)]);
      break;
    }
    default:
      return null;
  }
  const page =
    kind === 'booking-cancelled'
      ? '/booking/new'
      : `/booking/${encodeURIComponent(input.relatedBookingId ?? code)}`;
  const baseUrl =
    appearance.appBaseUrl && appearance.appBaseUrl.trim()
      ? appearance.appBaseUrl.trim().replace(/\/$/, '')
      : 'http://localhost:5173';
  const href = `${baseUrl}${page}`;
  const rendered = baseEmail(
    title,
    guestName,
    status,
    rows,
    notes,
    cta,
    href,
    appearance,
  );
  return {
    to: input.to,
    template: kind as NotificationTemplate,
    subject: `${title} · ${code}`,
    ...rendered,
  };
}

/** Validate and render before enqueueing: queued messages cannot be mutated by callers. */
export function renderNotification(
  input: NotificationInput,
  appearance: {
    logoUrl?: string;
    bannerUrl?: string;
    appBaseUrl?: string;
  } = {},
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
  const modern = renderModern(input, appearance);
  if (modern) return modern;
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
    case 'CHECK_IN_CONFIRMATION': {
      const data = input.data;
      subject = `Đã nhận phòng booking ${code}`;
      lines.push(
        `Bạn đã nhận phòng thành công cho booking ${code}.`,
        `Nhận phòng: ${date(data.checkIn)}`,
        `Trả phòng: ${date(data.checkOut)}`,
        field(data.roomsSummary),
      );
      break;
    }
    case 'CHECK_OUT_RECEIPT': {
      const data = input.data;
      subject = `Hóa đơn trả phòng booking ${code}`;
      lines.push(
        `Cảm ơn bạn đã lưu trú. Booking ${code} đã trả phòng.`,
        `Ngày trả phòng: ${date(data.checkedOutAt)}`,
        `Tiền phòng: ${money(data.roomTotal)}`,
        `Dịch vụ: ${money(data.serviceTotal)}`,
        `Phụ phí: ${money(data.additionalTotal)}`,
        `Tổng cộng: ${money(data.totalAmount)}`,
        `Đã đặt cọc: ${money(data.depositPaid)}`,
        `Đã thanh toán khi trả phòng: ${money(data.finalPaid)}`,
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
