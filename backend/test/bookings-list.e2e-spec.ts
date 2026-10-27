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
import { Room } from '../src/modules/rooms/schemas/room.schema.js';
import { RoomType } from '../src/modules/room-types/schemas/room-type.schema.js';

describe('View booking list (e2e)', () => {
  let app: INestApplication;
  let bookings: Model<Booking>;
  let rooms: Model<Room>;
  let roomTypes: Model<RoomType>;
  const tag = String(new Types.ObjectId()).slice(-8).toUpperCase();
  const typeId = new Types.ObjectId();
  const roomA = new Types.ObjectId();
  const staffId = new Types.ObjectId();
  const http = () => request(app.getHttpServer());
  const RECEPTIONIST = {
    'x-dev-role': 'RECEPTIONIST',
    'x-dev-user-id': String(staffId),
  };

  const seed = (
    suffix: string,
    checkIn: string,
    status: BookingStatus,
    extra: Partial<Booking> = {},
  ) =>
    bookings.create({
      code: `LST${tag}${suffix}`,
      guestName: `Guest ${tag} ${suffix}`,
      guestEmail: `${suffix.toLowerCase()}-${tag}@example.test`.toLowerCase(),
      guestPhone: '0922222222',
      rooms: [roomA],
      checkIn: new Date(`${checkIn}T00:00:00.000+07:00`),
      checkOut: new Date(
        new Date(`${checkIn}T00:00:00.000+07:00`).getTime() + 2 * 86_400_000,
      ),
      guests: 2,
      status,
      roomTotal: 2000000,
      depositAmount: 600000,
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
    rooms = app.get(getModelToken(Room.name));
    roomTypes = app.get(getModelToken(RoomType.name));
    await Promise.all([bookings.init(), rooms.init(), roomTypes.init()]);
    await roomTypes.create({
      _id: typeId,
      name: `LIST Deluxe ${typeId}`,
      adultCapacity: 2,
      childCapacity: 1,
      basePrice: 1000000,
    });
    await rooms.create({
      _id: roomA,
      roomNumber: `LS-${roomA}`,
      floor: 1,
      roomType: typeId,
      status: 'AVAILABLE',
    });
    await seed('A', '2093-01-10', BookingStatus.Confirmed, {
      createdBy: staffId,
    });
    await seed('B', '2093-02-10', BookingStatus.PendingDeposit);
    await seed('C', '2093-03-10', BookingStatus.Cancelled);
  });

  afterAll(async () => {
    await bookings.deleteMany({ code: new RegExp(`^LST${tag}`) });
    await rooms.deleteOne({ _id: roomA });
    await roomTypes.deleteOne({ _id: typeId });
    await app.close();
  });

  const list = (query: Record<string, string | number> = {}) =>
    http()
      .get('/api/v1/bookings')
      .set(RECEPTIONIST)
      .query({ q: tag, ...query });

  it('lets receptionist and manager list, and rejects others', async () => {
    await list().expect(200);
    await http()
      .get('/api/v1/bookings')
      .set({
        'x-dev-role': 'MANAGER',
        'x-dev-user-id': String(new Types.ObjectId()),
      })
      .expect(200);
    await http()
      .get('/api/v1/bookings')
      .set({
        'x-dev-role': 'CUSTOMER',
        'x-dev-user-id': String(new Types.ObjectId()),
      })
      .expect(403);
    await http().get('/api/v1/bookings').expect(401);
  });

  it('returns newest check-in first with room info and the walk-in flag', async () => {
    const { body } = await list().expect(200);
    expect(body.total).toBe(3);
    expect(body.items.map((item: { code: string }) => item.code)).toEqual([
      `LST${tag}C`,
      `LST${tag}B`,
      `LST${tag}A`,
    ]);
    const walkIn = body.items[2];
    expect(walkIn).toMatchObject({
      status: 'CONFIRMED',
      guestName: `Guest ${tag} A`,
      guests: 2,
      roomTotal: 2000000,
      walkIn: true,
    });
    expect(walkIn.rooms).toEqual([
      expect.objectContaining({
        id: String(roomA),
        roomNumber: `LS-${roomA}`,
        roomTypeName: `LIST Deluxe ${typeId}`,
      }),
    ]);
    expect(body.items[1].walkIn).toBe(false);
  });

  it('filters by status', async () => {
    const { body } = await list({ status: 'CANCELLED' }).expect(200);
    expect(body.total).toBe(1);
    expect(body.items[0].code).toBe(`LST${tag}C`);
  });

  it('searches by code, guest name, email and phone', async () => {
    for (const q of [
      `LST${tag}B`.toLowerCase(),
      `guest ${tag} b`,
      `b-${tag}@example`,
    ]) {
      const { body } = await list({ q }).expect(200);
      expect(body.items.map((item: { code: string }) => item.code)).toEqual([
        `LST${tag}B`,
      ]);
    }
    const phone = await list({ q: '0922222222' }).expect(200);
    expect(phone.body.total).toBeGreaterThanOrEqual(3);
  });

  it('treats the search text literally, not as a regex', async () => {
    const { body } = await list({ q: '.*' }).expect(200);
    expect(body.total).toBe(0);
  });

  it('filters by check-in date range (Vietnam business days, inclusive)', async () => {
    const { body } = await list({
      checkInFrom: '2093-02-10',
      checkInTo: '2093-03-10',
    }).expect(200);
    expect(body.items.map((item: { code: string }) => item.code)).toEqual([
      `LST${tag}C`,
      `LST${tag}B`,
    ]);
    const onlyFirst = await list({ checkInTo: '2093-01-10' }).expect(200);
    expect(onlyFirst.body.total).toBe(1);
  });

  it('paginates and validates the query', async () => {
    const page = await list({ limit: 2, page: 2 }).expect(200);
    expect(page.body).toMatchObject({ total: 3, page: 2, limit: 2 });
    expect(page.body.items).toHaveLength(1);
    await list({ limit: 101 }).expect(400);
    await list({ status: 'NOPE' }).expect(400);
    await list({ checkInFrom: '10/01/2093' }).expect(400);
  });
});
