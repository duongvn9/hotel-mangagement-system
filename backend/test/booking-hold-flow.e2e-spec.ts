import { VersioningType, type INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { Model, Types } from 'mongoose';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { BookingsService } from '../src/modules/bookings/bookings.service.js';
import { Booking } from '../src/modules/bookings/schemas/booking.schema.js';
import { RoomHold } from '../src/modules/bookings/schemas/room-hold.schema.js';
import { Room } from '../src/modules/rooms/schemas/room.schema.js';
import { RoomType } from '../src/modules/room-types/schemas/room-type.schema.js';
import { assertTestDatabase } from './test-database.js';

/** TO-BE giữ phòng: ROOM_HELD -> PENDING_DEPOSIT, EXPIRED, chống lạm dụng. */
describe('Booking hold flow (e2e)', () => {
  let app: INestApplication;
  let service: BookingsService;
  let bookings: Model<Booking>;
  let holds: Model<RoomHold>;
  let rooms: Model<Room>;
  let roomTypes: Model<RoomType>;
  const typeId = new Types.ObjectId();
  const roomA = new Types.ObjectId();
  const http = () => request(app.getHttpServer());

  const holdBody = (
    room: Types.ObjectId,
    checkIn: string,
    checkOut: string,
    adultCount = 2,
  ) => ({ rooms: [String(room)], checkIn, checkOut, adultCount });

  const clean = async () => {
    await holds.deleteMany({});
    await bookings.deleteMany({ rooms: { $in: [roomA] } });
  };

  beforeAll(async () => {
    assertTestDatabase(process.env.MONGODB_URI);
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    await app.init();
    service = app.get(BookingsService);
    bookings = app.get(getModelToken(Booking.name));
    holds = app.get(getModelToken(RoomHold.name));
    rooms = app.get(getModelToken(Room.name));
    roomTypes = app.get(getModelToken(RoomType.name));
    await Promise.all([bookings.init(), holds.init(), rooms.init()]);
    await roomTypes.create({
      _id: typeId,
      name: `HOLD Deluxe ${typeId}`,
      adultCapacity: 2,
      childCapacity: 1,
      basePrice: 1000000,
    });
    await rooms.create({
      _id: roomA,
      roomNumber: `HOLD-A-${roomA}`,
      floor: 1,
      roomType: typeId,
      status: 'AVAILABLE',
    });
  });

  beforeEach(clean);

  afterAll(async () => {
    await clean();
    await rooms.deleteOne({ _id: roomA });
    await roomTypes.deleteOne({ _id: typeId });
    await app.close();
  });

  it('holds a room as ROOM_HELD with a token and a 15-minute deadline', async () => {
    const response = await http()
      .post('/api/v1/bookings/hold')
      .send(holdBody(roomA, '2093-03-01', '2093-03-03'))
      .expect(201);
    expect(response.body).toMatchObject({
      status: 'ROOM_HELD',
      adultCount: 2,
      childCount: 0,
      roomTotal: 2000000,
    });
    expect(response.body.holdToken).toMatch(/^[A-Za-z0-9_-]{10,}$/);
    const remaining = Date.parse(response.body.holdExpiresAt) - Date.now();
    expect(remaining).toBeGreaterThan(10 * 60 * 1000);
    expect(remaining).toBeLessThanOrEqual(15 * 60 * 1000);
    const saved = await bookings.findById(response.body.bookingId).lean();
    expect(saved?.status).toBe('ROOM_HELD');
    expect(saved?.guestName).toBeUndefined();
  });

  it('reuses the same hold within one guest session (no new hold, no extension)', async () => {
    const agent = request.agent(app.getHttpServer());
    const first = await agent
      .post('/api/v1/bookings/hold')
      .send(holdBody(roomA, '2093-03-05', '2093-03-07'))
      .expect(201);
    const second = await agent
      .post('/api/v1/bookings/hold')
      .send(holdBody(roomA, '2093-03-10', '2093-03-12'))
      .expect(201);
    expect(second.body.bookingId).toBe(first.body.bookingId);
    expect(second.body.holdToken).toBe(first.body.holdToken);
    expect(second.body.holdExpiresAt).toBe(first.body.holdExpiresAt);
    expect(await bookings.countDocuments({ rooms: roomA })).toBe(1);
  });

  it('submits contact details to move ROOM_HELD to PENDING_DEPOSIT', async () => {
    const held = await http()
      .post('/api/v1/bookings/hold')
      .send(holdBody(roomA, '2093-04-01', '2093-04-03'))
      .expect(201);
    const response = await http()
      .post('/api/v1/bookings/details')
      .send({
        holdToken: held.body.holdToken,
        guestName: 'Held Guest',
        guestEmail: 'held@example.test',
        guestPhone: '0900000000',
      })
      .expect(200);
    expect(response.body.status).toBe('PENDING_DEPOSIT');
    // Cùng một cửa sổ: không gia hạn khi nộp thông tin.
    expect(response.body.holdExpiresAt).toBe(held.body.holdExpiresAt);
    const saved = await bookings.findById(held.body.bookingId).lean();
    expect(saved).toMatchObject({
      status: 'PENDING_DEPOSIT',
      guestName: 'Held Guest',
      guestEmail: 'held@example.test',
    });
  });

  it('reads authoritative booking state and deadline from the server by session', async () => {
    const agent = request.agent(app.getHttpServer());
    const held = await agent
      .post('/api/v1/bookings/hold')
      .send(holdBody(roomA, '2093-05-01', '2093-05-03'))
      .expect(201);
    const read = await agent
      .get(`/api/v1/bookings/${held.body.bookingId}`)
      .expect(200);
    expect(read.body).toMatchObject({
      id: held.body.bookingId,
      status: 'ROOM_HELD',
      holdExpiresAt: held.body.holdExpiresAt,
    });
  });

  it('excludes a held room from availability', async () => {
    await http()
      .post('/api/v1/bookings/hold')
      .send(holdBody(roomA, '2093-06-01', '2093-06-03'))
      .expect(201);
    const response = await http()
      .get('/api/v1/availability')
      .query({ checkIn: '2093-06-01', checkOut: '2093-06-03', guests: 2 })
      .expect(200);
    const ids = (response.body as { id: string }[]).map((room) => room.id);
    expect(ids).not.toContain(String(roomA));
  });

  it('expires an unconfirmed hold on read (lazy) and frees the room', async () => {
    const agent = request.agent(app.getHttpServer());
    const held = await agent
      .post('/api/v1/bookings/hold')
      .send(holdBody(roomA, '2093-07-01', '2093-07-03'))
      .expect(201);
    await holds.updateOne(
      { booking: new Types.ObjectId(held.body.bookingId) },
      { $set: { expiresAt: new Date(Date.now() - 1000) } },
    );
    const read = await agent
      .get(`/api/v1/bookings/${held.body.bookingId}`)
      .expect(200);
    expect(read.body.status).toBe('EXPIRED');
    expect(read.body.holdExpiresAt).toBeUndefined();
    const response = await http()
      .get('/api/v1/availability')
      .query({ checkIn: '2093-07-01', checkOut: '2093-07-03', guests: 2 })
      .expect(200);
    const ids = (response.body as { id: string }[]).map((room) => room.id);
    expect(ids).toContain(String(roomA));
  });

  it('expires stale holds through the periodic sweep', async () => {
    const held = await http()
      .post('/api/v1/bookings/hold')
      .send(holdBody(roomA, '2093-08-01', '2093-08-03'))
      .expect(201);
    await holds.updateOne(
      { booking: new Types.ObjectId(held.body.bookingId) },
      { $set: { expiresAt: new Date(Date.now() - 1000) } },
    );
    const expired = await service.sweepExpired();
    expect(expired).toBeGreaterThanOrEqual(1);
    const saved = await bookings.findById(held.body.bookingId).lean();
    expect(saved?.status).toBe('EXPIRED');
    const hold = await holds
      .findOne({ booking: new Types.ObjectId(held.body.bookingId) })
      .lean();
    expect(hold?.isActive).toBe(false);
  });

  it('rate-limits repeated holds from the same client', async () => {
    // Ba lượt giữ (ngày không chồng nhau) từ cùng client đều qua.
    const slots: [string, string][] = [
      ['2093-09-01', '2093-09-03'],
      ['2093-09-08', '2093-09-10'],
      ['2093-09-15', '2093-09-17'],
    ];
    const ip = '203.0.113.9';
    for (const [checkIn, checkOut] of slots) {
      await http()
        .post('/api/v1/bookings/hold')
        .set('x-forwarded-for', ip)
        .send(holdBody(roomA, checkIn, checkOut))
        .expect(201);
    }
    // Lượt thứ 4 trong cửa sổ bị chặn.
    await http()
      .post('/api/v1/bookings/hold')
      .set('x-forwarded-for', ip)
      .send(holdBody(roomA, '2093-10-01', '2093-10-03'))
      .expect(429);
  });
});
