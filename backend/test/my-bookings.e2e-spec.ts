import { VersioningType, type INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { type Model, Types } from 'mongoose';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { Room } from '../src/modules/rooms/schemas/room.schema.js';
import { RoomType } from '../src/modules/room-types/schemas/room-type.schema.js';
import {
  Booking,
  BookingSource,
  BookingStatus,
} from '../src/modules/bookings/schemas/booking.schema.js';
import {
  PaymentMethod,
  PaymentPurpose,
  PaymentStatus,
  PaymentTransaction,
} from '../src/modules/payments/schemas/payment-transaction.schema.js';

describe('GET /bookings/mine (e2e)', () => {
  let app: INestApplication;
  let bookings: Model<Booking>;
  let payments: Model<PaymentTransaction>;
  let rooms: Model<Room>;
  let roomTypes: Model<RoomType>;
  const customerC = new Types.ObjectId();
  const roomTypeId = new Types.ObjectId();
  const roomId = new Types.ObjectId();
  const customerA = new Types.ObjectId();
  const customerB = new Types.ObjectId();
  const prefix = 'MINE-E2E-';
  const http = () => request(app.getHttpServer());

  function makeBooking(
    customer: Types.ObjectId,
    code: string,
    checkIn: string,
    checkOut: string,
  ) {
    return {
      customer,
      code: prefix + code,
      rooms: [new Types.ObjectId()],
      guestName: 'Mine Guest',
      guestEmail: 'mine@example.test',
      guestPhone: '0900000000',
      checkIn: new Date(`${checkIn}T00:00:00.000Z`),
      checkOut: new Date(`${checkOut}T00:00:00.000Z`),
      adultCount: 2,
      roomTotal: 2000000,
      depositAmount: 200000,
      source: BookingSource.Online,
      status: BookingStatus.PendingDeposit,
    };
  }

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    await app.init();
    bookings = app.get(getModelToken(Booking.name));
    payments = app.get(getModelToken(PaymentTransaction.name));
    rooms = app.get(getModelToken(Room.name));
    roomTypes = app.get(getModelToken(RoomType.name));
    await roomTypes.create({
      _id: roomTypeId,
      name: prefix + 'Suite',
      adultCapacity: 2,
      childCapacity: 1,
      basePrice: 1000000,
      images: [
        '/images/seeds/room-types/suite-01.jpg',
        '/images/seeds/room-types/suite-02.jpg',
      ],
    });
    await rooms.create({
      _id: roomId,
      roomNumber: 'MINE-301',
      floor: 3,
      roomType: roomTypeId,
    });
    const created = await bookings.create([
      makeBooking(customerA, 'A1', '2095-01-10', '2095-01-12'),
      makeBooking(customerA, 'A2', '2095-02-10', '2095-02-12'),
      makeBooking(customerB, 'B1', '2095-03-10', '2095-03-12'),
      {
        ...makeBooking(customerC, 'C1', '2095-04-10', '2095-04-12'),
        rooms: [roomId],
      },
    ]);
    const a2 = created[1]._id;
    const payment = (
      ref: string,
      status: PaymentStatus,
      amount: number,
      extra: Partial<PaymentTransaction> = {},
    ) => ({
      booking: a2,
      invoice: new Types.ObjectId(),
      transactionRef: prefix + ref,
      method: PaymentMethod.Vnpay,
      purpose: PaymentPurpose.Deposit,
      status,
      amount,
      ...extra,
    });
    await payments.create([
      payment('P1', PaymentStatus.Success, 150000),
      payment('P2', PaymentStatus.Success, 50000, {
        purpose: PaymentPurpose.Final,
      }),
      payment('P3', PaymentStatus.Pending, 999000),
      payment('P4', PaymentStatus.Failed, 777000),
      payment('P5', PaymentStatus.Success, 555000, { isActive: false }),
    ]);
  }, 30000);

  afterAll(async () => {
    if (payments)
      await payments.deleteMany({ transactionRef: { $regex: '^' + prefix } });
    if (bookings) await bookings.deleteMany({ code: { $regex: '^' + prefix } });
    await rooms?.deleteOne({ _id: roomId });
    await roomTypes?.deleteOne({ _id: roomTypeId });
    await app?.close();
  });

  it('returns only the signed-in customer’s own bookings, newest first', async () => {
    const response = await http()
      .get('/api/v1/bookings/mine')
      .set({ 'x-dev-role': 'CUSTOMER', 'x-dev-user-id': String(customerA) })
      .expect(200);
    const codes = response.body.map((item: { code: string }) => item.code);
    expect(codes).toEqual([prefix + 'A2', prefix + 'A1']); // mới nhất trước
    expect(response.body[0]).toMatchObject({
      code: prefix + 'A2',
      status: 'PENDING_DEPOSIT',
      roomCount: 1,
      roomTotal: 2000000,
      depositAmount: 200000,
    });
    expect(codes).not.toContain(prefix + 'B1');
  });

  it('adds the total of successful payments as paidAmount', async () => {
    const response = await http()
      .get('/api/v1/bookings/mine')
      .set({ 'x-dev-role': 'CUSTOMER', 'x-dev-user-id': String(customerA) })
      .expect(200);
    const paid = Object.fromEntries(
      response.body.map((item: { code: string; paidAmount: number }) => [
        item.code,
        item.paidAmount,
      ]),
    );
    // Chỉ tính giao dịch SUCCESS còn hiệu lực; PENDING, FAILED và bản ghi đã tắt bị loại.
    expect(paid[prefix + 'A2']).toBe(200000);
    expect(paid[prefix + 'A1']).toBe(0);
  });

  it('adds the room type name and photo, room number and floor for the dashboard cards', async () => {
    const response = await http()
      .get('/api/v1/bookings/mine')
      .set({ 'x-dev-role': 'CUSTOMER', 'x-dev-user-id': String(customerC) })
      .expect(200);

    expect(response.body).toHaveLength(1);
    expect(response.body[0]).toMatchObject({
      code: prefix + 'C1',
      roomTypeName: prefix + 'Suite',
      roomTypeImage: '/images/seeds/room-types/suite-01.jpg',
      roomNumber: 'MINE-301',
      roomFloor: 3,
    });
  });

  it('leaves the room fields out when the room cannot be found', async () => {
    const response = await http()
      .get('/api/v1/bookings/mine')
      .set({ 'x-dev-role': 'CUSTOMER', 'x-dev-user-id': String(customerA) })
      .expect(200);

    for (const item of response.body) {
      expect(item.roomTypeName).toBeUndefined();
      expect(item.roomNumber).toBeUndefined();
    }
  });

  it('requires authentication', async () => {
    await http().get('/api/v1/bookings/mine').expect(401);
  });

  it('denies non-customer roles', async () => {
    for (const role of ['RECEPTIONIST', 'MANAGER']) {
      await http()
        .get('/api/v1/bookings/mine')
        .set({ 'x-dev-role': role })
        .expect(403);
    }
  });
});
