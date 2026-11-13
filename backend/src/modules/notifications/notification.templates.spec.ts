import { BookingStatus } from '../../common/constants/booking-status.enum.js';
import { PaymentPurpose } from '../payments/schemas/payment-transaction.schema.js';
import { renderNotification } from './notification.templates.js';
import type { NotificationInput } from './notification.types.js';

const stay = {
  bookingCode: 'GE-123',
  guestName: '<script>"A" & \'B\'</script>',
  checkIn: new Date('2026-10-23T18:00:00Z'),
  checkOut: '2026-10-25',
};
const booking = (
  bookingStatus: BookingStatus.PendingDeposit | BookingStatus.Confirmed,
): NotificationInput => ({
  to: 'alice@example.com',
  template: 'BOOKING_CONFIRMATION',
  data: {
    ...stay,
    bookingStatus,
    roomsSummary: '<img src=x> & Deluxe',
    roomTotal: 1234567,
    depositAmount: 500000,
  },
});
describe('H9 Vietnamese templates', () => {
  it.each([
    {
      type: 'booking-confirmed' as const,
      data: {
        bookingCode: 'GE-250',
        guestName: '<script>Lan</script>',
        room: 'Deluxe',
        checkIn: new Date('2026-10-23T18:00:00Z'),
        checkOut: new Date('2026-10-25T18:00:00Z'),
        nights: 2,
        guests: 2,
        total: 1250000,
        depositStatus: 'pending' as const,
        depositAmount: 500000,
      },
    },
    {
      type: 'deposit-paid' as const,
      data: {
        bookingCode: 'GE-250',
        guestName: 'Lan',
        transactionRef: 'VN-1',
        amount: 1250000,
        paidAt: new Date('2026-10-23T18:00:00Z'),
        bookingState: 'CONFIRMED',
      },
    },
    {
      type: 'final-payment-paid' as const,
      data: {
        bookingCode: 'GE-250',
        guestName: 'Lan',
        transactionRef: 'VN-2',
        amount: 1250000,
        paidAt: new Date('2026-10-23T18:00:00Z'),
        bookingState: 'CHECKED_OUT',
        outstandingBalance: 0,
        roomCharges: 1000000,
        serviceCharges: 300000,
        additionalCharges: 0,
        discounts: 50000,
        total: 1250000,
      },
    },
    {
      type: 'booking-cancelled' as const,
      data: {
        bookingCode: 'GE-250',
        guestName: 'Lan',
        checkIn: new Date('2026-10-23T18:00:00Z'),
        checkOut: new Date('2026-10-25T18:00:00Z'),
        cancelledAt: new Date('2026-10-22T18:00:00Z'),
        refundInfo: 'Refund pending',
      },
    },
  ])(
    'renders modern $type email with escaped HTML and plain text',
    ({ type, data }) => {
      const message = renderNotification({
        to: 'alice@example.com',
        type,
        data,
      } as NotificationInput);
      expect(message.html).toContain('<!doctype html>');
      expect(message.html).toContain('max-width:600px');
      expect(message.html).not.toContain('<script>');
      expect(message.html).toContain('(+84) 258 3888 999');
      expect(message.html).toContain('http://localhost:5173/booking/');
      expect(message.text.length).toBeGreaterThan(20);
      expect(message.text).toContain('24/10/2026');
      expect(message.text).toContain('Hotline: (+84) 258 3888 999');
      if (type === 'booking-confirmed') {
        expect(message.text).toContain('1.250.000 ₫');
        expect(message.html).toContain('&lt;script&gt;Lan&lt;/script&gt;');
        expect(message.text).toContain('Vui lòng thanh toán');
      }
    },
  );
  it.each([BookingStatus.PendingDeposit, BookingStatus.Confirmed])(
    'renders truthful status %s, VN dates/money and escaped HTML',
    (status) => {
      const message = renderNotification(booking(status));
      expect(message.subject).toBe(
        `${status === BookingStatus.PendingDeposit ? 'Đang chờ đặt cọc' : 'Đã xác nhận'} booking GE-123`,
      );
      expect(message.text).toContain('24/10/2026');
      expect(message.text).toContain('25/10/2026');
      expect(message.text).toContain('1.234.567');
      expect(message.text).toContain('500.000');
      expect(message.text).toContain('₫');
      expect(message.html).toContain(
        '&lt;script&gt;&quot;A&quot; &amp; &#39;B&#39;&lt;/script&gt;',
      );
      expect(message.html).toContain('&lt;img src=x&gt; &amp; Deluxe');
      expect(message.html).not.toContain('<script>');
      expect(message.subject).not.toMatch(/[\r\n]/);
    },
  );
  it.each([PaymentPurpose.Deposit, PaymentPurpose.Final])(
    'renders payment purpose %s and escapes all dynamic values',
    (purpose) => {
      const message = renderNotification({
        to: 'a@example.com',
        template: 'PAYMENT_SUCCESS',
        data: {
          bookingCode: '<BOOK&>',
          guestName: '<guest>',
          amount: 0,
          purpose,
          paidAt: new Date('2026-10-23T18:00:00Z'),
          transactionRef: '<TX&>',
        },
      });
      expect(message.text).toContain(
        purpose === PaymentPurpose.Deposit ? 'đặt cọc' : 'hóa đơn cuối',
      );
      expect(message.text).toContain('24/10/2026');
      expect(message.text).toContain('0');
      for (const value of [
        '&lt;BOOK&amp;&gt;',
        '&lt;guest&gt;',
        '&lt;TX&amp;&gt;',
      ])
        expect(message.html).toContain(value);
      expect(message.subject).not.toMatch(/[\r\n]/);
    },
  );
  it('renders cancellation with plain text and escaped HTML', () => {
    const message = renderNotification({
      to: 'a@example.com',
      template: 'BOOKING_CANCELLATION',
      data: { ...stay, cancelledAt: '2026-10-24' },
    });
    expect(message.subject).toBe('Đã hủy booking GE-123');
    expect(message.text).toContain('đã được hủy');
    expect(message.html).toContain('Ngày hủy: 24/10/2026');
    expect(message.html).not.toContain('<script>');
  });
  it.each([
    { bookingCode: 'x\r\nBcc: a@example.com' },
    { guestName: '' },
    { checkIn: '2026-02-30' },
    { checkIn: new Date(NaN) },
    { checkOut: '2026-10-25T00:00:00Z' },
    { roomTotal: -1 },
    { roomTotal: 0.5 },
    { depositAmount: '5000' },
    { roomsSummary: 123 },
    { bookingStatus: BookingStatus.Cancelled },
  ])('rejects invalid required data %j', (data) => {
    const input = booking(BookingStatus.Confirmed);
    expect(() =>
      renderNotification({
        ...input,
        data: { ...input.data, ...data },
      } as never),
    ).toThrow();
  });
});
