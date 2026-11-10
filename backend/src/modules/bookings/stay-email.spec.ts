import {
  checkInConfirmationEmail,
  checkOutReceiptEmail,
} from './booking-email.js';

const booking = {
  code: 'GE-123',
  guestName: 'Alice',
  guestEmail: 'alice@example.com',
  checkIn: new Date('2026-11-09T07:00:00Z'),
  checkOut: new Date('2026-11-11T05:00:00Z'),
};

describe('checkInConfirmationEmail', () => {
  it('names the rooms the guest was given', () => {
    expect(checkInConfirmationEmail(booking, ['102', '301'])).toEqual({
      to: 'alice@example.com',
      template: 'CHECK_IN_CONFIRMATION',
      data: {
        bookingCode: 'GE-123',
        guestName: 'Alice',
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        roomsSummary: 'Phòng 102, 301',
      },
    });
  });

  it('sends nothing when the booking has no email', () => {
    expect(
      checkInConfirmationEmail({ ...booking, guestEmail: undefined }, ['102']),
    ).toBeNull();
  });
});

describe('checkOutReceiptEmail', () => {
  const invoice = {
    roomTotal: 1_700_000,
    serviceTotal: 150_000,
    additionalTotal: 50_000,
    totalAmount: 1_900_000,
    depositPaid: 170_000,
    finalPaid: 1_730_000,
  };

  it('copies the invoice totals and the check-out time', () => {
    const checkedOutAt = new Date('2026-11-11T05:00:00Z');

    expect(checkOutReceiptEmail(booking, invoice, checkedOutAt)).toEqual({
      to: 'alice@example.com',
      template: 'CHECK_OUT_RECEIPT',
      data: {
        bookingCode: 'GE-123',
        guestName: 'Alice',
        checkedOutAt,
        ...invoice,
      },
    });
  });

  it('sends nothing when the booking has no email', () => {
    expect(
      checkOutReceiptEmail({ ...booking, guestEmail: '' }, invoice, new Date()),
    ).toBeNull();
  });
});
