import { VersioningType, type INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { type Model, Types } from 'mongoose';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import {
  Booking,
  BookingSource,
  BookingStatus,
} from '../src/modules/bookings/schemas/booking.schema.js';

describe('GET /bookings/mine (e2e)', () => {
  let app: INestApplication;
  let bookings: Model<Booking>;
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
    await bookings.create([
      makeBooking(customerA, 'A1', '2095-01-10', '2095-01-12'),
      makeBooking(customerA, 'A2', '2095-02-10', '2095-02-12'),
      makeBooking(customerB, 'B1', '2095-03-10', '2095-03-12'),
    ]);
  }, 30000);

  afterAll(async () => {
    if (bookings) await bookings.deleteMany({ code: { $regex: '^' + prefix } });
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
