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
