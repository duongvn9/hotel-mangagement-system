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
import { Invoice } from '../src/modules/invoices/schemas/invoice.schema.js';
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

/** Commit 3: thanh toán phải nhất quán với hold (chỉ confirm khi còn giữ phòng hợp lệ). */
describe('Payment consistency with room hold (e2e)', () => {
  let app: INestApplication;
  let bookings: Model<Booking>;
  let holds: Model<RoomHold>;
  let payments: Model<PaymentTransaction>;
  let invoices: Model<Invoice>;
  let rooms: Model<Room>;
  let roomTypes: Model<RoomType>;
  const typeId = new Types.ObjectId();
  const roomId = new Types.ObjectId();
  const http = () => request(app.getHttpServer());
  const STAFF = { 'x-dev-role': 'MANAGER' };
  let txnSeq = 800000;
  const nextTxnNo = () => String(++txnSeq);

  const details = {
    guestName: 'Hold Payer',
    guestEmail: 'payer@example.test',
    guestPhone: '0900000000',
  };

  /** Giữ phòng rồi nhập thông tin -> PENDING_DEPOSIT; trả bookingId + holdToken. */
  async function reachPendingDeposit(
    checkIn: string,
    checkOut: string,
    ip: string,
  ): Promise<{ bookingId: string; holdToken: string }> {
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
    return { bookingId: held.body.bookingId, holdToken: held.body.holdToken };
  }

  const availableIds = async (checkIn: string, checkOut: string) => {
    const response = await http()
      .get('/api/v1/availability')
      .query({ checkIn, checkOut, guests: 2 })
      .expect(200);
    return (response.body as { id: string }[]).map((room) => room.id);
  };

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
    invoices = app.get(getModelToken(Invoice.name));
    rooms = app.get(getModelToken(Room.name));
    roomTypes = app.get(getModelToken(RoomType.name));
    await Promise.all([bookings.init(), holds.init(), rooms.init()]);
    await roomTypes.create({
      _id: typeId,
      name: `PAY Deluxe ${typeId}`,
      adultCapacity: 2,
      childCapacity: 1,
      basePrice: 1000000,
    });
    await rooms.create({
      _id: roomId,
      roomNumber: `PAY-${roomId}`,
      floor: 1,
      roomType: typeId,
      status: 'AVAILABLE',
    });
  });

  const clean = async () => {
    const docs = await bookings.find({ rooms: roomId }).select('_id').lean();
    const ids = docs.map((doc) => doc._id);
    await payments.deleteMany({ booking: { $in: ids } });
    await invoices.deleteMany({ booking: { $in: ids } });
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

  it('confirms the booking and deactivates the hold when the deposit settles in time', async () => {
    const { bookingId } = await reachPendingDeposit(
      '2095-01-10',
      '2095-01-12',
      '203.0.113.21',
    );
    const deposit = await http()
      .post('/api/v1/payments/deposit')
      .set(STAFF)
      .send({ bookingId })
      .expect(201);
    expect(deposit.body.amount).toBe(600000);

    const callback = await http()
      .get(
        `/api/v1/payments/vnpay/ipn?${ipn(deposit.body.transactionRef, 600000, nextTxnNo())}`,
      )
      .expect(200);
    expect(callback.body.RspCode).toBe('00');

    expect((await bookings.findById(bookingId))?.status).toBe('CONFIRMED');
    const hold = await holds
      .findOne({ booking: new Types.ObjectId(bookingId) })
      .lean();
    expect(hold?.isActive).toBe(false);
    const payment = await payments
      .findOne({ transactionRef: deposit.body.transactionRef })
      .lean();
    expect(payment).toMatchObject({
      status: 'SUCCESS',
      needsReconciliation: false,
    });
  });

  it('does not confirm an expired booking on a late deposit and flags it for reconciliation', async () => {
    const { bookingId } = await reachPendingDeposit(
      '2095-02-10',
      '2095-02-12',
      '203.0.113.22',
    );
    const deposit = await http()
      .post('/api/v1/payments/deposit')
      .set(STAFF)
      .send({ bookingId })
      .expect(201);

    // Hold hết hạn trước khi tiền về (sweep đã chuyển booking sang EXPIRED).
    await bookings.updateOne(
      { _id: new Types.ObjectId(bookingId) },
      { $set: { status: 'EXPIRED' } },
    );
    await holds.updateOne(
      { booking: new Types.ObjectId(bookingId) },
      { $set: { isActive: false, expiresAt: new Date(Date.now() - 1000) } },
    );

    const callback = await http()
      .get(
        `/api/v1/payments/vnpay/ipn?${ipn(deposit.body.transactionRef, 600000, nextTxnNo())}`,
      )
      .expect(200);
    // VNPay vẫn được ACK (tiền có thật), nhưng booking không được confirm.
    expect(callback.body.RspCode).toBe('00');
    expect((await bookings.findById(bookingId))?.status).toBe('EXPIRED');

    const payment = await payments
      .findOne({ transactionRef: deposit.body.transactionRef })
      .lean();
    expect(payment).toMatchObject({
      status: 'SUCCESS',
      needsReconciliation: true,
    });

    // Phòng được giải phóng: không double booking cho kỳ ở đó.
    expect(await availableIds('2095-02-10', '2095-02-12')).toContain(
      String(roomId),
    );
  });

  it('does not confirm when the hold lapsed before the IPN but the sweep has not run yet', async () => {
    const { bookingId } = await reachPendingDeposit(
      '2095-04-10',
      '2095-04-12',
      '203.0.113.24',
    );
    // Cọc khởi tạo lúc hold còn hợp lệ.
    const deposit = await http()
      .post('/api/v1/payments/deposit')
      .set(STAFF)
      .send({ bookingId })
      .expect(201);

    // Hold vừa quá hạn nhưng sweep CHƯA chạy: hold vẫn active, booking vẫn PENDING_DEPOSIT.
    await holds.updateOne(
      { booking: new Types.ObjectId(bookingId) },
      { $set: { expiresAt: new Date(Date.now() - 1000) } },
    );

    const callback = await http()
      .get(
        `/api/v1/payments/vnpay/ipn?${ipn(deposit.body.transactionRef, 600000, nextTxnNo())}`,
      )
      .expect(200);
    // Tiền có thật nên ACK VNPay, nhưng adapter tự phát hiện hold quá hạn: không confirm.
    expect(callback.body.RspCode).toBe('00');
    expect((await bookings.findById(bookingId))?.status).toBe('EXPIRED');
    const hold = await holds
      .findOne({ booking: new Types.ObjectId(bookingId) })
      .lean();
    expect(hold?.isActive).toBe(false);

    const payment = await payments
      .findOne({ transactionRef: deposit.body.transactionRef })
      .lean();
    expect(payment).toMatchObject({
      status: 'SUCCESS',
      needsReconciliation: true,
    });

    // Phòng được giải phóng dù sweep chưa kịp chạy.
    expect(await availableIds('2095-04-10', '2095-04-12')).toContain(
      String(roomId),
    );
  });

  it('rejects a deposit once the hold has expired and expires the booking', async () => {
    const { bookingId } = await reachPendingDeposit(
      '2095-03-10',
      '2095-03-12',
      '203.0.113.23',
    );
    // Quá hạn giữ phòng nhưng sweep chưa chạy: booking vẫn PENDING_DEPOSIT.
    await holds.updateOne(
      { booking: new Types.ObjectId(bookingId) },
      { $set: { expiresAt: new Date(Date.now() - 1000) } },
    );

    await http()
      .post('/api/v1/payments/deposit')
      .set(STAFF)
      .send({ bookingId })
      .expect(409);

    expect((await bookings.findById(bookingId))?.status).toBe('EXPIRED');
    const hold = await holds
      .findOne({ booking: new Types.ObjectId(bookingId) })
      .lean();
    expect(hold?.isActive).toBe(false);
  });
});
