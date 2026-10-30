import { VersioningType, type INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { Model, Types } from 'mongoose';
import { createHmac, randomInt } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { Booking } from '../src/modules/bookings/schemas/booking.schema.js';
import { RoomHold } from '../src/modules/bookings/schemas/room-hold.schema.js';
import { Invoice } from '../src/modules/invoices/schemas/invoice.schema.js';
import { PaymentTransaction } from '../src/modules/payments/schemas/payment-transaction.schema.js';
import { Room } from '../src/modules/rooms/schemas/room.schema.js';
import { RoomType } from '../src/modules/room-types/schemas/room-type.schema.js';
import { VnpayService } from '../src/modules/payments/vnpay.service.js';

const settings = {
  tmnCode: 'TESTCODE',
  hashSecret: 'fixture-secret',
  paymentUrl: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
  returnUrl: 'http://localhost/payment/return',
  ipnUrl: '',
};

function ipn(
  txnRef: string,
  purpose: 'DEPOSIT' | 'FINAL',
  amountVnd: number,
  transactionNo: string,
): string {
  const data: Record<string, string> = {
    vnp_Amount: String(amountVnd * 100),
    vnp_BankCode: 'NCB',
    vnp_OrderInfo: `HMS ${purpose} ${txnRef}`,
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
  return `${query}&vnp_SecureHash=${createHmac('sha512', settings.hashSecret).update(query).digest('hex')}`;
}

// Luồng đầy đủ: tạo booking -> đặt cọc (IPN) -> CONFIRMED -> thanh toán cuối (IPN) -> PAID.
describe('Booking to payment full flow (e2e)', () => {
  let app: INestApplication;
  let bookings: Model<Booking>;
  let invoices: Model<Invoice>;
  let payments: Model<PaymentTransaction>;
  let holds: Model<RoomHold>;
  let rooms: Model<Room>;
  let roomTypes: Model<RoomType>;
  const typeId = new Types.ObjectId();
  const roomId = new Types.ObjectId();
  const customerId = new Types.ObjectId();
  const http = () => request(app.getHttpServer());
  const CUSTOMER = {
    'x-dev-role': 'CUSTOMER',
    'x-dev-user-id': String(customerId),
    'x-forwarded-for': '203.0.113.9',
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
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
    holds = app.get(getModelToken(RoomHold.name));
    rooms = app.get(getModelToken(Room.name));
    roomTypes = app.get(getModelToken(RoomType.name));
    await Promise.all([
      bookings.init(),
      invoices.init(),
      payments.init(),
      holds.init(),
      rooms.init(),
      roomTypes.init(),
    ]);
    await roomTypes.create({
      _id: typeId,
      name: `FLOW Deluxe ${typeId}`,
      adultCapacity: 2,
      childCapacity: 1,
      basePrice: 1000000,
    });
    await rooms.create({
      _id: roomId,
      roomNumber: `F-${roomId}`,
      floor: 1,
      roomType: typeId,
      status: 'AVAILABLE',
    });
  });

  afterAll(async () => {
    const docs = await bookings.find({ rooms: roomId }).select('_id').lean();
    const filter = { booking: { $in: docs.map((d) => d._id) } };
    await payments.deleteMany(filter);
    await holds.deleteMany(filter);
    await invoices.deleteMany(filter);
    await bookings.deleteMany({ rooms: roomId });
    await rooms.deleteOne({ _id: roomId });
    await roomTypes.deleteOne({ _id: typeId });
    await app.close();
  });

  it('runs create -> deposit -> confirm -> final -> paid', async () => {
    // 1. Tạo booking: 2 đêm x 1.000.000 = 2.000.000; cọc 10% = 200.000.
    const created = await http()
      .post('/api/v1/bookings')
      .set(CUSTOMER)
      .send({
        rooms: [String(roomId)],
        checkIn: '2094-01-10',
        checkOut: '2094-01-12',
        adultCount: 2,
        guestName: 'Flow',
        guestEmail: 'flow@example.test',
        guestPhone: '0900000000',
      })
      .expect(201);
    const bookingId = created.body.id as string;
    expect(created.body.depositAmount).toBe(200000);

    // 2. Khởi tạo đặt cọc.
    const deposit = await http()
      .post('/api/v1/payments/deposit')
      .set(CUSTOMER)
      .send({ bookingId })
      .expect(201);
    expect(deposit.body.amount).toBe(200000);

    // 3. VNPay IPN báo cọc thành công -> booking CONFIRMED.
    const depositIpn = await http()
      .get(
        `/api/v1/payments/vnpay/ipn?${ipn(deposit.body.transactionRef, 'DEPOSIT', 200000, String(randomInt(1e13, 1e14)))}`,
      )
      .expect(200);
    expect(depositIpn.body.RspCode).toBe('00');
    expect((await bookings.findById(bookingId))?.status).toBe('CONFIRMED');
    expect(
      await invoices.findOne({ booking: new Types.ObjectId(bookingId) }),
    ).toMatchObject({
      depositPaid: 200000,
      balanceDue: 1800000,
      status: 'PARTIALLY_PAID',
    });

    // 4. Thanh toán cuối cho dư nợ 1.800.000.
    const final = await http()
      .post('/api/v1/payments/final')
      .set(CUSTOMER)
      .send({ bookingId })
      .expect(201);
    expect(final.body.amount).toBe(1800000);

    // 5. IPN thanh toán cuối -> hoá đơn PAID.
    const finalIpn = await http()
      .get(
        `/api/v1/payments/vnpay/ipn?${ipn(final.body.transactionRef, 'FINAL', 1800000, String(randomInt(1e13, 1e14)))}`,
      )
      .expect(200);
    expect(finalIpn.body.RspCode).toBe('00');
    expect(
      await invoices.findOne({ booking: new Types.ObjectId(bookingId) }),
    ).toMatchObject({ finalPaid: 1800000, balanceDue: 0, status: 'PAID' });
  });
});
