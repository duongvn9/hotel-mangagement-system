import { VersioningType, type INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { Model, Types } from 'mongoose';
import { createHmac } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { Booking } from '../src/modules/bookings/schemas/booking.schema.js';
import { Invoice } from '../src/modules/invoices/schemas/invoice.schema.js';
import { InvoicePricingAdapter } from '../src/modules/invoices/invoice-adapters.js';
import { PaymentTransaction } from '../src/modules/payments/schemas/payment-transaction.schema.js';
import { VnpayService } from '../src/modules/payments/vnpay.service.js';

const settings = {
  tmnCode: 'TESTCODE',
  hashSecret: 'fixture-secret',
  paymentUrl: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
  returnUrl: 'http://localhost/payment/return',
  ipnUrl: '',
};

function ipnCallback(
  txnRef: string,
  amountVnd: number,
  changes: Record<string, string | undefined> = {},
): string {
  const data: Record<string, string | undefined> = {
    vnp_Amount: String(amountVnd * 100),
    vnp_BankCode: 'NCB',
    vnp_OrderInfo: `HMS DEPOSIT ${txnRef}`,
    vnp_PayDate: '20261023120000',
    vnp_ResponseCode: '00',
    vnp_TmnCode: settings.tmnCode,
    vnp_TransactionNo: '990123',
    vnp_TransactionStatus: '00',
    vnp_TxnRef: txnRef,
    ...changes,
  };
  const query = Object.keys(data)
    .sort()
    .filter((key) => data[key] !== undefined)
    .map(
      (key) => `${key}=${encodeURIComponent(data[key]!).replace(/%20/g, '+')}`,
    )
    .join('&');
  return `${query}&vnp_SecureHash=${createHmac('sha512', settings.hashSecret).update(query).digest('hex')}`;
}

describe('Payments VNPay endpoints (e2e)', () => {
  let app: INestApplication;
  let bookings: Model<Booking>;
  let invoices: Model<Invoice>;
  let payments: Model<PaymentTransaction>;
  const customerId = new Types.ObjectId();
  const bookingId = new Types.ObjectId();
  const http = () => request(app.getHttpServer());
  const CUSTOMER = {
    'x-dev-role': 'CUSTOMER',
    'x-dev-user-id': String(customerId),
    'x-forwarded-for': '203.0.113.9',
  };

  const seedBooking = () =>
    bookings.create({
      _id: bookingId,
      code: `PAY-${bookingId}`,
      customer: customerId,
      rooms: [new Types.ObjectId()],
      guestName: 'Payment test',
      guestEmail: 'pay@example.test',
      guestPhone: '0900000000',
      checkIn: new Date('2026-10-23'),
      checkOut: new Date('2026-10-25'),
      adultCount: 2,
      roomTotal: 1000000,
      depositAmount: 300000,
      status: 'PENDING_DEPOSIT',
    });

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(InvoicePricingAdapter)
      .useValue({
        getRoomLines: async (booking: Booking) =>
          booking.rooms.map((room) => ({
            roomId: String(room),
            rate: 1000000,
            units: 1,
          })),
      })
      .overrideProvider(VnpayService)
      .useValue(new VnpayService({ get: () => settings } as never))
      .compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    await app.init();
    bookings = app.get(getModelToken(Booking.name));
    invoices = app.get(getModelToken(Invoice.name));
    payments = app.get(getModelToken(PaymentTransaction.name));
    await Promise.all([bookings.init(), invoices.init(), payments.init()]);
  });

  beforeEach(async () => {
    await payments.deleteMany({ booking: bookingId });
    await invoices.deleteMany({ booking: bookingId });
    await bookings.deleteMany({ _id: bookingId });
  });

  afterAll(async () => {
    await payments.deleteMany({ booking: bookingId });
    await invoices.deleteMany({ booking: bookingId });
    await bookings.deleteMany({ _id: bookingId });
    await app.close();
  });

  it('rejects unauthenticated deposit initiation', async () => {
    await seedBooking();
    await http()
      .post('/api/v1/payments/deposit')
      .send({ bookingId: String(bookingId) })
      .expect(401);
  });

  it('initiates a deposit for the booking owner and records a pending payment', async () => {
    await seedBooking();
    const response = await http()
      .post('/api/v1/payments/deposit')
      .set(CUSTOMER)
      .send({ bookingId: String(bookingId) })
      .expect(201);

    expect(response.body.amount).toBe(300000);
    expect(response.body.transactionRef).toMatch(/^[A-Za-z0-9]+$/);
    expect(response.body.paymentUrl).toContain(settings.paymentUrl);
    expect(response.body.paymentUrl).toContain('vnp_SecureHash=');
    const pending = await payments.findOne({
      transactionRef: response.body.transactionRef,
    });
    expect(pending?.status).toBe('PENDING');
    expect(pending?.amount).toBe(300000);
  });

  it('forbids initiating a deposit on a booking the customer does not own', async () => {
    await seedBooking();
    await http()
      .post('/api/v1/payments/deposit')
      .set({ ...CUSTOMER, 'x-dev-user-id': String(new Types.ObjectId()) })
      .send({ bookingId: String(bookingId) })
      .expect(403);
  });

  it('rejects a second pending deposit for the same booking', async () => {
    await seedBooking();
    await http()
      .post('/api/v1/payments/deposit')
      .set(CUSTOMER)
      .send({ bookingId: String(bookingId) })
      .expect(201);
    await http()
      .post('/api/v1/payments/deposit')
      .set(CUSTOMER)
      .send({ bookingId: String(bookingId) })
      .expect(409);
  });

  it('settles a deposit through IPN and is idempotent on replay', async () => {
    await seedBooking();
    const init = await http()
      .post('/api/v1/payments/deposit')
      .set(CUSTOMER)
      .send({ bookingId: String(bookingId) })
      .expect(201);
    const txnRef = init.body.transactionRef as string;

    const raw = ipnCallback(txnRef, 300000);
    const first = await http()
      .get(`/api/v1/payments/vnpay/ipn?${raw}`)
      .expect(200);
    expect(first.body).toEqual({ RspCode: '00', Message: 'Confirm Success' });
    expect((await bookings.findById(bookingId))?.status).toBe('CONFIRMED');
    expect(await invoices.findOne({ booking: bookingId })).toMatchObject({
      depositPaid: 300000,
      balanceDue: 700000,
      status: 'PARTIALLY_PAID',
    });

    const replay = await http()
      .get(`/api/v1/payments/vnpay/ipn?${raw}`)
      .expect(200);
    expect(replay.body).toEqual({
      RspCode: '02',
      Message: 'Order already confirmed',
    });
  });

  it('returns Order not found for an unknown IPN transaction', async () => {
    const raw = ipnCallback('UNKNOWNREF123', 300000);
    const response = await http()
      .get(`/api/v1/payments/vnpay/ipn?${raw}`)
      .expect(200);
    expect(response.body).toEqual({
      RspCode: '01',
      Message: 'Order not found',
    });
  });

  it('verifies a return redirect read-only without changing state', async () => {
    await seedBooking();
    const init = await http()
      .post('/api/v1/payments/deposit')
      .set(CUSTOMER)
      .send({ bookingId: String(bookingId) })
      .expect(201);
    const txnRef = init.body.transactionRef as string;

    const response = await http()
      .get(`/api/v1/payments/vnpay/return?${ipnCallback(txnRef, 300000)}`)
      .expect(200);
    expect(response.body).toMatchObject({
      transactionRef: txnRef,
      status: 'SUCCESS',
    });
    // Return không đổi trạng thái: payment vẫn PENDING, booking vẫn chờ cọc.
    expect((await payments.findOne({ transactionRef: txnRef }))?.status).toBe(
      'PENDING',
    );
    expect((await bookings.findById(bookingId))?.status).toBe(
      'PENDING_DEPOSIT',
    );
  });
});
