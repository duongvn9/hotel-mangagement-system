import { model, Types } from 'mongoose';
import { BookingSchema, BookingStatus } from './booking.schema.js';
import { RoomHoldSchema } from './room-hold.schema.js';
import { InvoiceSchema } from '../../invoices/schemas/invoice.schema.js';
import { PaymentTransactionSchema } from '../../payments/schemas/payment-transaction.schema.js';

const Booking = model('BookingValidation', BookingSchema);
const Hold = model('HoldValidation', RoomHoldSchema);
const Invoice = model('InvoiceValidation', InvoiceSchema);
const Payment = model('PaymentValidation', PaymentTransactionSchema);
const booking = () => ({
  code: 'TEST',
  guestName: 'Guest',
  guestEmail: 'guest@example.test',
  guestPhone: '0900000000',
  rooms: [new Types.ObjectId(), new Types.ObjectId()],
  checkIn: new Date('2026-10-23T07:00:00Z'),
  checkOut: new Date('2026-10-24T05:00:00Z'),
  adultCount: 2,
  childCount: 0,
  roomTotal: 1000000,
  depositAmount: 500000,
});

describe('H5 schema validation', () => {
  it('uses exactly the shared booking statuses and supports multiple Room refs', async () => {
    expect(Object.values(BookingStatus)).toEqual([
      'ROOM_HELD',
      'PENDING_DEPOSIT',
      'CONFIRMED',
      'CHECKED_IN',
      'CHECKED_OUT',
      'CANCELLED',
      'EXPIRED',
    ]);
    const doc = new Booking(booking());
    await expect(doc.validate()).resolves.toBeUndefined();
    expect(doc.status).toBe(BookingStatus.PendingDeposit);
    expect(doc.isActive).toBe(true);
    expect(doc.rooms).toHaveLength(2);
    expect(doc.checkIn.toISOString()).toBe('2026-10-23T07:00:00.000Z');
  });

  it.each(
    [
      [],
      [null],
      ['invalid'],
      (() => {
        const id = new Types.ObjectId();
        return [id, id];
      })(),
    ].map((rooms) => ({ rooms })),
  )('rejects invalid room arrays $rooms', async ({ rooms }) => {
    await expect(
      new Booking({ ...booking(), rooms }).validate(),
    ).rejects.toThrow();
  });

  it('requires guest details, dates, occupancy and valid enums', async () => {
    await expect(new Booking({}).validate()).rejects.toThrow();
    for (const patch of [
      { guestName: '' },
      { guestEmail: '' },
      { guestPhone: '' },
      { checkIn: null },
      { checkOut: null },
      { adultCount: 0 },
      { adultCount: 1.5 },
      { childCount: -1 },
      { status: 'BOGUS' },
      { checkOut: booking().checkIn },
    ]) {
      await expect(
        new Booking({ ...booking(), ...patch }).validate(),
      ).rejects.toThrow();
    }
  });

  it.each([-1, 0.5, Number.MAX_SAFE_INTEGER + 1, Infinity, NaN])(
    'rejects invalid VND %s across all financial fields',
    async (amount) => {
      for (const field of ['roomTotal', 'depositAmount']) {
        await expect(
          new Booking({ ...booking(), [field]: amount }).validate(),
        ).rejects.toThrow();
      }
      for (const field of [
        'roomTotal',
        'serviceTotal',
        'additionalTotal',
        'discountTotal',
        'taxTotal',
        'totalAmount',
        'depositPaid',
        'finalPaid',
        'balanceDue',
      ]) {
        await expect(
          new Invoice({
            booking: new Types.ObjectId(),
            code: 'INV',
            [field]: amount,
          }).validate(),
        ).rejects.toThrow();
      }
      await expect(
        new Payment({
          booking: new Types.ObjectId(),
          invoice: new Types.ObjectId(),
          transactionRef: 'REF',
          method: 'VNPAY',
          purpose: 'DEPOSIT',
          amount,
        }).validate(),
      ).rejects.toThrow();
    },
  );

  it('validates invoice breakdown and payment balance', async () => {
    const data = {
      booking: new Types.ObjectId(),
      code: 'INV',
      roomTotal: 1000,
      serviceTotal: 200,
      additionalTotal: 100,
      discountTotal: 50,
      taxTotal: 50,
      totalAmount: 1300,
      depositPaid: 500,
      finalPaid: 300,
      balanceDue: 500,
      status: 'PARTIALLY_PAID',
    };
    await expect(new Invoice(data).validate()).resolves.toBeUndefined();
    for (const patch of [
      { totalAmount: 1200 },
      { balanceDue: 0 },
      { depositPaid: 2000 },
      { status: 'UNKNOWN' },
    ]) {
      await expect(
        new Invoice({ ...data, ...patch }).validate(),
      ).rejects.toThrow();
    }
    await expect(new Invoice({}).validate()).rejects.toThrow();
  });

  it('requires hold token/expiry and valid stay/rooms, exposes availability index', async () => {
    const data = {
      booking: new Types.ObjectId(),
      holdToken: 'HOLD_TOKEN_SAMPLE_0001',
      rooms: booking().rooms,
      checkIn: booking().checkIn,
      checkOut: booking().checkOut,
      expiresAt: new Date(),
    };
    await expect(new Hold(data).validate()).resolves.toBeUndefined();
    for (const patch of [
      { holdToken: undefined },
      { expiresAt: null },
      { expiresAt: 'invalid' },
      { rooms: [] },
      { checkOut: data.checkIn },
      { booking: null },
    ]) {
      await expect(
        new Hold({ ...data, ...patch }).validate(),
      ).rejects.toThrow();
    }
    // Không còn TTL tự xoá: backend chủ động nhả hold quá hạn.
    expect(RoomHoldSchema.indexes()).not.toContainEqual([
      { expiresAt: 1 },
      { expireAfterSeconds: 0 },
    ]);
    expect(
      RoomHoldSchema.indexes().some(
        ([keys]) => keys.rooms === 1 && keys.expiresAt === 1,
      ),
    ).toBe(true);
  });

  it('requires transaction refs, amount, purpose, method and valid status', async () => {
    const data = {
      booking: new Types.ObjectId(),
      invoice: new Types.ObjectId(),
      transactionRef: 'REF',
      method: 'VNPAY',
      purpose: 'DEPOSIT',
      amount: 0,
    };
    await expect(new Payment(data).validate()).resolves.toBeUndefined();
    for (const patch of [
      { transactionRef: '' },
      { amount: null },
      { booking: null },
      { invoice: null },
      { purpose: 'OTHER' },
      { method: 'OTHER' },
      { status: 'OTHER' },
    ]) {
      await expect(
        new Payment({ ...data, ...patch }).validate(),
      ).rejects.toThrow();
    }
  });
});
