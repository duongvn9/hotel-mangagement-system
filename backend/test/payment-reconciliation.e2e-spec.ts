import { VersioningType, type INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { Model, Types } from 'mongoose';
import { createHmac } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { Booking } from '../src/modules/bookings/schemas/booking.schema.js';
import { RoomHold } from '../src/modules/bookings/schemas/room-hold.schema.js';
import { PaymentTransaction } from '../src/modules/payments/schemas/payment-transaction.schema.js';
import { Room } from '../src/modules/rooms/schemas/room.schema.js';
import { RoomType } from '../src/modules/room-types/schemas/room-type.schema.js';
import { VnpayService } from '../src/modules/payments/vnpay.service.js';
import { assertTestDatabase } from './test-database.js';

const settings = {
  tmnCode: 'TESTCODE',
  hashSecret: 'fixture-secret',
  paymentUrl: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
  returnUrl: 'http://localhost/payment/return',
  ipnUrl: '',
};

/** Dựng query IPN hợp lệ (chữ ký) cho một giao dịch VNPay thành công. */
function ipn(txnRef: string, amountVnd: number, transactionNo: string): string {
  const data: Record<string, string> = {
    vnp_Amount: String(amountVnd * 100),
    vnp_BankCode: 'NCB',
    vnp_OrderInfo: `HMS DEPOSIT ${txnRef}`,
    vnp_PayDate: '20261024120000',
    vnp_ResponseCode: '00',
    vnp_TmnCode: settings.tmnCode,
    vnp_TransactionNo: transactionNo,
    vnp_TransactionStatus: '00',
    vnp_TxnRef: txnRef,
  };
  const query = Object.keys(data)
    .sort()
    .map((k) => `${k}=${encodeURIComponent(data[k]).replace(/%20/g, '+')}`)
    .join('&');
  return `${query}&vnp_SecureHash=${createHmac('sha512', settings.hashSecret)
    .update(query)
    .digest('hex')}`;
}

/** Commit 3 — Issue ②: Manager nhìn thấy và xử lý các khoản tiền về muộn cần đối soát. */
describe('Payment reconciliation queue (e2e)', () => {
  let app: INestApplication;
  let bookings: Model<Booking>;
  let holds: Model<RoomHold>;
  let payments: Model<PaymentTransaction>;
  let rooms: Model<Room>;
  let roomTypes: Model<RoomType>;
  const typeId = new Types.ObjectId();
  const roomId = new Types.ObjectId();
  const http = () => request(app.getHttpServer());
  const MANAGER = { 'x-dev-role': 'MANAGER' };
  const CUSTOMER = { 'x-dev-role': 'CUSTOMER' };
  let txnSeq = 900000;
  const nextTxnNo = () => String(++txnSeq);

  const details = {
    guestName: 'Late Payer',
    guestEmail: 'late@example.test',
    guestPhone: '0900000000',
  };

  /** Giữ phòng -> nhập thông tin -> cọc, rồi ép hold quá hạn trước khi IPN về (tiền muộn). */
  async function flagLatePayment(
    checkIn: string,
    checkOut: string,
    ip: string,
  ): Promise<{ bookingId: string; transactionRef: string }> {
    const held = await http()
      .post('/api/v1/bookings/hold')
      .set('x-forwarded-for', ip)
      .send({ rooms: [String(roomId)], checkIn, checkOut, adultCount: 2 })
      .expect(201);
    await http()
      .post('/api/v1/bookings/details')
      .set('x-forwarded-for', ip)
      .send({ holdToken: held.body.holdToken, ...details })
      .expect(200);
    const deposit = await http()
      .post('/api/v1/payments/deposit')
      .set(MANAGER)
      .send({ bookingId: held.body.bookingId })
      .expect(201);

    // Hold vừa quá hạn nhưng sweep CHƯA chạy (booking vẫn PENDING_DEPOSIT).
    await holds.updateOne(
      { booking: new Types.ObjectId(held.body.bookingId) },
      { $set: { expiresAt: new Date(Date.now() - 1000) } },
    );
    await http()
      .get(
        `/api/v1/payments/vnpay/ipn?${ipn(deposit.body.transactionRef, 200000, nextTxnNo())}`,
      )
      .expect(200);
    return {
      bookingId: held.body.bookingId,
      transactionRef: deposit.body.transactionRef,
    };
  }

  beforeAll(async () => {
    assertTestDatabase(process.env.MONGODB_URI);
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(VnpayService)
      .useValue(new VnpayService({ get: () => settings } as never))
      .compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    await app.init();
    bookings = app.get(getModelToken(Booking.name));
    holds = app.get(getModelToken(RoomHold.name));
    payments = app.get(getModelToken(PaymentTransaction.name));
    rooms = app.get(getModelToken(Room.name));
    roomTypes = app.get(getModelToken(RoomType.name));
    await Promise.all([bookings.init(), holds.init(), rooms.init()]);
    await roomTypes.create({
      _id: typeId,
      name: `RECON Deluxe ${typeId}`,
      adultCapacity: 2,
      childCapacity: 1,
      basePrice: 1000000,
    });
    await rooms.create({
      _id: roomId,
      roomNumber: `RECON-${roomId}`,
      floor: 1,
      roomType: typeId,
      status: 'AVAILABLE',
    });
  });

  const clean = async () => {
    const docs = await bookings.find({ rooms: roomId }).select('_id').lean();
    const ids = docs.map((doc) => doc._id);
    await payments.deleteMany({ booking: { $in: ids } });
    await holds.deleteMany({});
    await bookings.deleteMany({ rooms: roomId });
  };

  beforeEach(clean);

  afterAll(async () => {
    await clean();
    await rooms.deleteOne({ _id: roomId });
    await roomTypes.deleteOne({ _id: typeId });
    await app.close();
  });

  it('lists a flagged late payment and lets a manager resolve it off the queue', async () => {
    const { bookingId } = await flagLatePayment(
      '2096-01-10',
      '2096-01-12',
      '203.0.113.31',
    );

    const list = await http()
      .get('/api/v1/payments/reconciliation')
      .set(MANAGER)
      .expect(200);
    expect(list.body.total).toBe(1);
    expect(list.body.items[0]).toMatchObject({
      bookingId,
      bookingStatus: 'EXPIRED',
      purpose: 'DEPOSIT',
      amount: 200000,
    });

    const paymentId = list.body.items[0].id;
    const resolved = await http()
      .post(`/api/v1/payments/${paymentId}/reconcile`)
      .set(MANAGER)
      .send({ note: 'Refunded manually via VNPay portal' })
      .expect(200);
    expect(resolved.body).toMatchObject({
      id: paymentId,
      needsReconciliation: false,
      reconciliationNote: 'Refunded manually via VNPay portal',
    });
    expect(resolved.body.reconciledBy).toMatch(/^[a-f\d]{24}$/i);

    const stored = await payments.findById(paymentId).lean();
    expect(stored?.needsReconciliation).toBe(false);
    expect(stored?.reconciledAt).toBeTruthy();

    const after = await http()
      .get('/api/v1/payments/reconciliation')
      .set(MANAGER)
      .expect(200);
    expect(after.body.total).toBe(0);
  });

  it('rejects resolving a payment that is not flagged, and a bad id', async () => {
    const { transactionRef } = await flagLatePayment(
      '2096-02-10',
      '2096-02-12',
      '203.0.113.32',
    );
    const payment = await payments.findOne({ transactionRef }).lean();
    const paymentId = String(payment?._id);

    await http()
      .post(`/api/v1/payments/${paymentId}/reconcile`)
      .set(MANAGER)
      .send({ note: 'first' })
      .expect(200);
    // Lần hai: đã xử lý rồi -> 409.
    await http()
      .post(`/api/v1/payments/${paymentId}/reconcile`)
      .set(MANAGER)
      .send({ note: 'again' })
      .expect(409);
    // Id không tồn tại -> 404.
    await http()
      .post(`/api/v1/payments/${new Types.ObjectId()}/reconcile`)
      .set(MANAGER)
      .send({})
      .expect(404);
  });

  it('forbids non-managers from the reconciliation queue', async () => {
    await http()
      .get('/api/v1/payments/reconciliation')
      .set(CUSTOMER)
      .expect(403);
  });
});
