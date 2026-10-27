import { VersioningType, type INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { Model, Types } from 'mongoose';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import {
  Booking,
  BookingStatus,
} from '../src/modules/bookings/schemas/booking.schema.js';

describe('Guest profile search (e2e)', () => {
  let app: INestApplication;
  let bookings: Model<Booking>;
  const tag = String(new Types.ObjectId()).slice(-8).toUpperCase();
  const room = new Types.ObjectId();
  const customerId = new Types.ObjectId();
  const http = () => request(app.getHttpServer());
  const RECEPTIONIST = {
    'x-dev-role': 'RECEPTIONIST',
    'x-dev-user-id': String(new Types.ObjectId()),
  };
  const search = (query: Record<string, string | number>) =>
    http().get('/api/v1/guests').set(RECEPTIONIST).query(query);
  const vn = (day: string) => new Date(`${day}T00:00:00.000+07:00`);

  const seed = (
    suffix: string,
    guest: { name: string; email: string; phone: string },
    status: BookingStatus,
    checkIn: string,
    createdAt: string,
    extra: Partial<Booking> = {},
  ) =>
    bookings.create({
      code: `GST${tag}${suffix}`,
      guestName: guest.name,
      guestEmail: guest.email,
      guestPhone: guest.phone,
      rooms: [room],
      checkIn: vn(checkIn),
      checkOut: new Date(vn(checkIn).getTime() + 2 * 86_400_000),
      guests: 2,
      status,
      roomTotal: 1000000,
      depositAmount: 300000,
      createdAt: new Date(createdAt),
      ...extra,
    });

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    await app.init();
    bookings = app.get(getModelToken(Booking.name));
    await bookings.init();
    // Cùng một khách (email khác hoa/thường), 3 booking; booking mới nhất đổi tên và số điện thoại.
    await seed(
      'A1',
      {
        name: 'Ann Old',
        email: `ann-${tag}@example.test`,
        phone: '0900000001',
      },
      BookingStatus.CheckedOut,
      '2096-01-10',
      '2096-01-01T00:00:00Z',
    );
    await seed(
      'A2',
      {
        name: 'Ann Mid',
        email: `ANN-${tag}@Example.test`,
        phone: '0900000002',
      },
      BookingStatus.Confirmed,
      '2096-02-10',
      '2096-01-02T00:00:00Z',
      { customer: customerId },
    );
    await seed(
      'A3',
      {
        name: `Ann New ${tag}`,
        email: `ann-${tag}@example.test`,
        phone: '0900000003',
      },
      BookingStatus.Cancelled,
      '2096-03-10',
      '2096-01-03T00:00:00Z',
    );
    await seed(
      'B1',
      {
        name: 'Bob Walkin',
        email: `bob-${tag}@example.test`,
        phone: '0911111112',
      },
      BookingStatus.Confirmed,
      '2096-04-10',
      '2096-01-04T00:00:00Z',
    );
  });

  afterAll(async () => {
    await bookings.deleteMany({ code: new RegExp(`^GST${tag}`) });
    await app.close();
  });

  it('lets receptionist and manager search, and rejects others', async () => {
    await search({ q: tag }).expect(200);
    await http()
      .get('/api/v1/guests')
      .set({
        'x-dev-role': 'MANAGER',
        'x-dev-user-id': String(new Types.ObjectId()),
      })
      .query({ q: tag })
      .expect(200);
    await http()
      .get('/api/v1/guests')
      .set({
        'x-dev-role': 'CUSTOMER',
        'x-dev-user-id': String(new Types.ObjectId()),
      })
      .query({ q: tag })
      .expect(403);
    await http().get('/api/v1/guests').query({ q: tag }).expect(401);
  });

  it('merges bookings of the same email into one profile with stats', async () => {
    const { body } = await search({ q: tag }).expect(200);
    expect(body).toMatchObject({ total: 2, page: 1, limit: 20 });
    // Khách có booking tạo gần nhất đứng trước.
    expect(body.items.map((item: { email: string }) => item.email)).toEqual([
      `bob-${tag}@example.test`,
      `ann-${tag}@example.test`,
    ]);
    const ann = body.items[1];
    expect(ann).toMatchObject({
      name: `Ann New ${tag}`,
      phone: '0900000003',
      hasAccount: true,
      totalBookings: 3,
      completedStays: 1,
      // Booking đã huỷ không tính vào lần nhận phòng gần nhất.
      lastCheckIn: vn('2096-02-10').toISOString(),
    });
    expect(body.items[0]).toMatchObject({
      name: 'Bob Walkin',
      hasAccount: false,
      totalBookings: 1,
      completedStays: 0,
    });
  });

  it('searches by name, email, phone and booking code with full stats', async () => {
    for (const q of [
      `new ${tag}`,
      `ann-${tag}`.toUpperCase(),
      '0900000002',
      `GST${tag}A1`,
    ]) {
      const { body } = await search({ q }).expect(200);
      expect(body.total).toBe(1);
      expect(body.items[0]).toMatchObject({
        email: `ann-${tag}@example.test`,
        totalBookings: 3,
      });
    }
  });

  it('treats the search text literally, not as a regex', async () => {
    const { body } = await search({ q: '.*' }).expect(200);
    expect(body.total).toBe(0);
    expect(body.items).toEqual([]);
  });

  it('paginates', async () => {
    const { body } = await search({ q: tag, limit: 1, page: 2 }).expect(200);
    expect(body).toMatchObject({ total: 2, page: 2, limit: 1 });
    expect(body.items.map((item: { email: string }) => item.email)).toEqual([
      `ann-${tag}@example.test`,
    ]);
  });

  it('validates the query', async () => {
    await http().get('/api/v1/guests').set(RECEPTIONIST).expect(400);
    await search({ q: 'a' }).expect(400);
    await search({ q: '   ' }).expect(400);
    await search({ q: tag, limit: 101 }).expect(400);
    await search({ q: tag, page: 0 }).expect(400);
  });
});
