import { VersioningType, type INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { Model, Types } from 'mongoose';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { Booking } from '../src/modules/bookings/schemas/booking.schema.js';
import { RoomHold } from '../src/modules/bookings/schemas/room-hold.schema.js';
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

// Guest ẩn danh: đặt phòng public, thanh toán cọc bằng mã booking (vé).
describe('Guest booking and code-based deposit (e2e)', () => {
  let app: INestApplication;
  let bookings: Model<Booking>;
  let holds: Model<RoomHold>;
  let rooms: Model<Room>;
  let roomTypes: Model<RoomType>;
  const typeId = new Types.ObjectId();
  const roomId = new Types.ObjectId();
  const customerId = new Types.ObjectId();
  const http = () => request(app.getHttpServer());
  const guestBody = {
    rooms: [String(roomId)],
    checkIn: '2092-01-10',
    checkOut: '2092-01-12',
    guests: 2,
    guestName: 'Anon Guest',
    guestEmail: 'anon@example.test',
    guestPhone: '0900000000',
  };

  const clean = () => bookings.deleteMany({ rooms: { $in: [roomId] } });

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
    holds = app.get(getModelToken(RoomHold.name));
    rooms = app.get(getModelToken(Room.name));
    roomTypes = app.get(getModelToken(RoomType.name));
    await Promise.all([
      bookings.init(),
      holds.init(),
      rooms.init(),
      roomTypes.init(),
    ]);
    await roomTypes.create({
      _id: typeId,
      name: `GUEST Deluxe ${typeId}`,
      adultCapacity: 2,
      childCapacity: 1,
      basePrice: 1000000,
    });
    await rooms.create({
      _id: roomId,
      roomNumber: `G-${roomId}`,
      floor: 1,
      roomType: typeId,
      status: 'AVAILABLE',
    });
  });

  beforeEach(clean);

  afterAll(async () => {
    await clean();
    await rooms.deleteOne({ _id: roomId });
    await roomTypes.deleteOne({ _id: typeId });
    await app.close();
  });

  it('lets an anonymous guest create a booking without a customer', async () => {
    const response = await http()
      .post('/api/v1/bookings')
      .send(guestBody)
      .expect(201);
    expect(response.body.code).toMatch(/^BK/);
    expect(response.body.depositAmount).toBe(600000); // 30% của 2 đêm x 1.000.000
    const saved = await bookings.findById(response.body.id).lean();
    expect(saved?.customer).toBeUndefined();
  });

  it('lets the guest initiate the deposit with the booking code', async () => {
    const created = await http()
      .post('/api/v1/bookings')
      .send(guestBody)
      .expect(201);
    const response = await http()
      .post('/api/v1/payments/deposit')
      .set('x-forwarded-for', '203.0.113.9')
      .send({ bookingId: created.body.id, code: created.body.code })
      .expect(201);
    expect(response.body.amount).toBe(600000);
    expect(response.body.paymentUrl).toContain(settings.paymentUrl);
  });

  it('rejects a guest deposit without a code', async () => {
    const created = await http()
      .post('/api/v1/bookings')
      .send(guestBody)
      .expect(201);
    await http()
      .post('/api/v1/payments/deposit')
      .set('x-forwarded-for', '203.0.113.9')
      .send({ bookingId: created.body.id })
      .expect(401);
  });

  it('rejects a guest deposit with the wrong code', async () => {
    const created = await http()
      .post('/api/v1/bookings')
      .send(guestBody)
      .expect(201);
    await http()
      .post('/api/v1/payments/deposit')
      .set('x-forwarded-for', '203.0.113.9')
      .send({ bookingId: created.body.id, code: 'BKWRONG' })
      .expect(403);
  });

  it('does not let a guest code unlock a customer-owned booking', async () => {
    const created = await http()
      .post('/api/v1/bookings')
      .set({ 'x-dev-role': 'CUSTOMER', 'x-dev-user-id': String(customerId) })
      .send(guestBody)
      .expect(201);
    // Dù biết đúng mã, booking có customer nên Guest ẩn danh không được phép.
    await http()
      .post('/api/v1/payments/deposit')
      .set('x-forwarded-for', '203.0.113.9')
      .send({ bookingId: created.body.id, code: created.body.code })
      .expect(401);
  });
});
