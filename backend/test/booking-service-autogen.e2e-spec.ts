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
import { ServiceOrder } from '../src/modules/service-orders/schemas/service-order.schema.js';
import { ServiceOrdersService } from '../src/modules/service-orders/service-orders.service.js';
import { Service } from '../src/modules/services/schemas/service.schema.js';
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

/** Issue tách PR: tự sinh ServiceOrder từ dịch vụ khách chọn khi booking qua CONFIRMED. */
describe('Auto service-order generation on CONFIRMED (e2e)', () => {
  let app: INestApplication;
  let bookings: Model<Booking>;
  let orders: Model<ServiceOrder>;
  let services: Model<Service>;
  let rooms: Model<Room>;
  let roomTypes: Model<RoomType>;
  let payments: Model<PaymentTransaction>;
  let holds: Model<RoomHold>;
  let serviceOrders: ServiceOrdersService;
  const typeId = new Types.ObjectId();
  const roomId = new Types.ObjectId();
  const serviceId = new Types.ObjectId();
  const http = () => request(app.getHttpServer());
  const MANAGER = { 'x-dev-role': 'MANAGER' };
  let txnSeq = 700000;
  const nextTxnNo = () => String(++txnSeq);

  /** Hold -> details(+dịch vụ) -> deposit -> IPN success; trả bookingId. */
  async function reachConfirmed(
    checkIn: string,
    checkOut: string,
    ip: string,
    quantity: number,
    auth: Record<string, string> = {},
  ): Promise<string> {
    const held = await http()
      .post('/api/v1/bookings/hold')
      .set({ 'x-forwarded-for': ip, ...auth })
      .send({ rooms: [String(roomId)], checkIn, checkOut, adultCount: 2 })
      .expect(201);
    await http()
      .post('/api/v1/bookings/details')
      .set({ 'x-forwarded-for': ip, ...auth })
      .send({
        holdToken: held.body.holdToken,
        guestName: 'Service Picker',
        guestEmail: 'picker@example.test',
        guestPhone: '0900000000',
        serviceSelections: [{ serviceId: String(serviceId), quantity }],
      })
      .expect(200);
    const deposit = await http()
      .post('/api/v1/payments/deposit')
      .set(MANAGER)
      .send({ bookingId: held.body.bookingId })
      .expect(201);
    await http()
      .get(
        `/api/v1/payments/vnpay/ipn?${ipn(deposit.body.transactionRef, 200000, nextTxnNo())}`,
      )
      .expect(200);
    return held.body.bookingId as string;
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
    orders = app.get(getModelToken(ServiceOrder.name));
    services = app.get(getModelToken(Service.name));
    rooms = app.get(getModelToken(Room.name));
    roomTypes = app.get(getModelToken(RoomType.name));
    payments = app.get(getModelToken(PaymentTransaction.name));
    holds = app.get(getModelToken(RoomHold.name));
    serviceOrders = app.get(ServiceOrdersService);
    await Promise.all([bookings.init(), holds.init(), rooms.init()]);
    await roomTypes.create({
      _id: typeId,
      name: `AUTO Deluxe ${typeId}`,
      adultCapacity: 2,
      childCapacity: 1,
      basePrice: 1000000,
    });
    await rooms.create({
      _id: roomId,
      roomNumber: `AUTO-${roomId}`,
      floor: 1,
      roomType: typeId,
      status: 'AVAILABLE',
    });
    await services.create({
      _id: serviceId,
      name: `Laundry ${serviceId}`,
      unit: 'kg',
      billable: true,
      price: 50000,
      isActive: true,
    });
  });

  const clean = async () => {
    const docs = await bookings.find({ rooms: roomId }).select('_id').lean();
    const ids = docs.map((doc) => doc._id);
    await orders.deleteMany({ booking: { $in: ids } });
    await payments.deleteMany({ booking: { $in: ids } });
    await holds.deleteMany({});
    await bookings.deleteMany({ rooms: roomId });
  };

  beforeEach(clean);

  afterAll(async () => {
    await clean();
    await services.deleteOne({ _id: serviceId });
    await rooms.deleteOne({ _id: roomId });
    await roomTypes.deleteOne({ _id: typeId });
    await app.close();
  });

  it('auto-creates a ServiceOrder for a logged-in customer and is idempotent', async () => {
    const customerId = new Types.ObjectId();
    const bookingId = await reachConfirmed(
      '2097-01-10',
      '2097-01-12',
      '203.0.113.41',
      2,
      {
        'x-dev-role': 'CUSTOMER',
        'x-dev-user-id': String(customerId),
      },
    );

    expect((await bookings.findById(bookingId))?.status).toBe('CONFIRMED');
    const created = await orders
      .find({ booking: new Types.ObjectId(bookingId) })
      .lean();
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({
      service: serviceId,
      quantity: 2,
      unitPriceVND: 50000,
      amount: 100000,
      reviewStatus: 'PENDING_REVIEW',
      executionStatus: 'NOT_STARTED',
    });
    expect(String(created[0]?.customer)).toBe(String(customerId));

    // Idempotent: gọi lại không tạo trùng.
    await serviceOrders.generateForConfirmedBooking(bookingId);
    expect(
      await orders.countDocuments({ booking: new Types.ObjectId(bookingId) }),
    ).toBe(1);
  });

  it('auto-creates an unassigned ServiceOrder for a guest, visible to staff and linkable later', async () => {
    const bookingId = await reachConfirmed(
      '2097-02-10',
      '2097-02-12',
      '203.0.113.42',
      3,
    );

    const created = await orders
      .find({ booking: new Types.ObjectId(bookingId) })
      .lean();
    expect(created).toHaveLength(1);
    expect(created[0]?.customer).toBeUndefined();
    expect(created[0]).toMatchObject({ quantity: 3, amount: 150000 });

    // Lễ tân thấy đơn trong hàng đợi review dù khách không có tài khoản.
    const queue = await http()
      .get('/api/v1/service-orders/requests?reviewStatus=PENDING_REVIEW')
      .set({
        'x-dev-role': 'RECEPTIONIST',
        'x-dev-user-id': String(new Types.ObjectId()),
      })
      .expect(200);
    expect(
      (queue.body.items as { booking: { code: string } | null }[]).some(
        (item) => item.booking && item.booking.code.length > 0,
      ),
    ).toBe(true);

    // Gắn vào tài khoản customer tạo sau.
    const customerId = new Types.ObjectId();
    const linked = await serviceOrders.linkBookingOrdersToCustomer(
      bookingId,
      customerId,
    );
    expect(linked).toBe(1);
    const after = await orders
      .findOne({ booking: new Types.ObjectId(bookingId) })
      .lean();
    expect(String(after?.customer)).toBe(String(customerId));
  });
});
