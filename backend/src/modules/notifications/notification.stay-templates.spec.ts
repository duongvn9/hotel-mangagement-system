import { renderNotification } from './notification.templates.js';

describe('check-in confirmation email', () => {
  const message = renderNotification({
    to: 'alice@example.com',
    template: 'CHECK_IN_CONFIRMATION',
    data: {
      bookingCode: 'GE-123',
      guestName: '<Alice>',
      checkIn: '2026-11-09',
      checkOut: '2026-11-11',
      roomsSummary: 'Phòng 102',
    },
  });

  it('states the stay and the room in the subject and body', () => {
    expect(message.subject).toBe('Đã nhận phòng booking GE-123');
    expect(message.text).toContain('Nhận phòng: 09/11/2026');
    expect(message.text).toContain('Trả phòng: 11/11/2026');
    expect(message.text).toContain('Phòng 102');
  });

  it('escapes guest-supplied text in the HTML body', () => {
    expect(message.html).toContain('&lt;Alice&gt;');
    expect(message.html).not.toContain('<Alice>');
  });
});

describe('check-out receipt email', () => {
  const data = {
    bookingCode: 'GE-123',
    guestName: 'Alice',
    checkedOutAt: new Date('2026-11-11T05:00:00Z'),
    roomTotal: 1_700_000,
    serviceTotal: 150_000,
    additionalTotal: 50_000,
    totalAmount: 1_900_000,
    depositPaid: 170_000,
    finalPaid: 1_730_000,
  };

  it('lists every part of the invoice', () => {
    const message = renderNotification({
      to: 'alice@example.com',
      template: 'CHECK_OUT_RECEIPT',
      data,
    });

    expect(message.subject).toBe('Hóa đơn trả phòng booking GE-123');
    expect(message.text).toContain('Ngày trả phòng: 11/11/2026');
    for (const label of [
      'Tiền phòng',
      'Dịch vụ',
      'Phụ phí',
      'Tổng cộng',
      'Đã đặt cọc',
      'Đã thanh toán khi trả phòng',
    ]) {
      expect(message.text).toContain(label);
    }
    expect(message.text).toMatch(/Tổng cộng: .*1\.900\.000/);
  });

  it('rejects an amount that is not whole VND', () => {
    expect(() =>
      renderNotification({
        to: 'alice@example.com',
        template: 'CHECK_OUT_RECEIPT',
        data: { ...data, totalAmount: 1.5 },
      }),
    ).toThrow('invalid_money');
  });
});
