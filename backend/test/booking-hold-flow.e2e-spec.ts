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
      .send(holdBody(roomA, '2093-03-05', '2093-03-07'))
      .expect(201);
    expect(second.body.bookingId).toBe(first.body.bookingId);
    expect(second.body.holdToken).toBe(first.body.holdToken);
    expect(second.body.holdExpiresAt).toBe(first.body.holdExpiresAt);
    expect(await bookings.countDocuments({ rooms: roomA })).toBe(1);
  });

  it('does not reuse or transfer a manager hold after switching to a customer', async () => {
    const agent = request.agent(app.getHttpServer());
    const managerId = String(new Types.ObjectId());
    const customerId = String(new Types.ObjectId());
    const first = await agent
      .post('/api/v1/bookings/hold')
      .set('x-dev-role', 'MANAGER')
      .set('x-dev-user-id', managerId)
      .send(holdBody(roomA, '2093-03-01', '2093-03-03'))
      .expect(201);
    const second = await agent
      .post('/api/v1/bookings/hold')
      .set('x-dev-role', 'CUSTOMER')
      .set('x-dev-user-id', customerId)
      .send(holdBody(roomA, '2093-03-10', '2093-03-12'))
      .expect(201);
    expect(second.body.bookingId).not.toBe(first.body.bookingId);
    expect(
      String((await bookings.findById(second.body.bookingId))?.customer),
    ).toBe(customerId);
    expect(
      (await bookings.findById(first.body.bookingId))?.customer,
    ).toBeUndefined();
    await agent
      .get(`/api/v1/bookings/${first.body.bookingId}`)
      .set('x-dev-role', 'CUSTOMER')
      .set('x-dev-user-id', customerId)
      .expect(403);
    await agent
      .get(`/api/v1/bookings/${second.body.bookingId}`)
      .set('x-dev-role', 'CUSTOMER')
      .set('x-dev-user-id', customerId)
      .expect(200);
  });

  it.each([
    ['MANAGER', 'CUSTOMER'],
    ['CUSTOMER', 'CUSTOMER'],
    [undefined, 'CUSTOMER'],
    ['CUSTOMER', undefined],
  ])(
    'does not resume or transfer a %s hold after switching to %s',
    async (firstRole, secondRole) => {
      const agent = request.agent(app.getHttpServer());
      const firstUser = new Types.ObjectId();
      const secondUser = new Types.ObjectId();
      const firstHeaders = firstRole
        ? { 'x-dev-role': firstRole, 'x-dev-user-id': String(firstUser) }
        : {};
      const secondHeaders = secondRole
        ? { 'x-dev-role': secondRole, 'x-dev-user-id': String(secondUser) }
        : {};
      const first = await agent
        .post('/api/v1/bookings/hold')
        .set(firstHeaders)
        .send(holdBody(roomA, '2093-03-15', '2093-03-17'))
        .expect(201);
      const original = await bookings.findById(first.body.bookingId).lean();
      const second = await agent
        .post('/api/v1/bookings/hold')
        .set(secondHeaders)
        .send(holdBody(roomA, '2093-03-20', '2093-03-22'))
        .expect(201);
      expect(second.body.bookingId).not.toBe(first.body.bookingId);
      expect(second.body.holdToken).not.toBe(first.body.holdToken);
      expect(await bookings.findById(first.body.bookingId).lean()).toEqual(
        original,
      );
      expect(
        await holds
          .findOne({ booking: new Types.ObjectId(first.body.bookingId) })
          .lean(),
      ).toMatchObject({ isActive: true });
      const fresh = await bookings.findById(second.body.bookingId).lean();
      expect(fresh?.customer?.toString()).toBe(
        secondRole ? String(secondUser) : undefined,
      );
      if (firstRole === 'MANAGER') {
        expect(original?.createdBy?.toString()).toBe(String(firstUser));
        expect(original?.customer).toBeUndefined();
      }
      // Returning to the first principal resumes its original hold, not the latest account's.
      const resumed = await agent
        .post('/api/v1/bookings/hold')
        .set(firstHeaders)
        .send(holdBody(roomA, '2093-03-15', '2093-03-17'))
        .expect(201);
      expect(resumed.body.bookingId).toBe(first.body.bookingId);
      expect(resumed.body.holdExpiresAt).toBe(first.body.holdExpiresAt);
    },
  );

  it("does not release another account's inventory when creating a new hold", async () => {
    const agent = request.agent(app.getHttpServer());
    const firstUser = new Types.ObjectId();
    const first = await agent
      .post('/api/v1/bookings/hold')
      .set({ 'x-dev-role': 'MANAGER', 'x-dev-user-id': String(firstUser) })
      .send(holdBody(roomA, '2093-03-15', '2093-03-17'))
      .expect(201);
    await agent
      .post('/api/v1/bookings/hold')
      .set({
        'x-dev-role': 'CUSTOMER',
        'x-dev-user-id': String(new Types.ObjectId()),
      })
      .send(holdBody(roomA, '2093-03-15', '2093-03-17'))
      .expect(409);
    expect(await bookings.findById(first.body.bookingId).lean()).toMatchObject({
      status: 'ROOM_HELD',
    });
    expect(
      await holds
        .findOne({ booking: new Types.ObjectId(first.body.bookingId) })
        .lean(),
    ).toMatchObject({ isActive: true });
  });

  it.each(['CUSTOMER', 'MANAGER', undefined])(
    'blocks a different checkout for %s and exposes the active booking without transferring it',
    async (role) => {
      const agent = request.agent(app.getHttpServer());
      const headers = role
        ? { 'x-dev-role': role, 'x-dev-user-id': String(new Types.ObjectId()) }
        : {};
      const body = holdBody(roomA, '2093-04-01', '2093-04-03');
      const held = await agent
        .post('/api/v1/bookings/hold')
        .set(headers)
        .send(body)
        .expect(201);
      const client = role ? http() : agent;
      const conflict = await client
        .post('/api/v1/bookings/hold')
        .set(headers)
        .send({ ...body, checkOut: '2093-04-04' })
        .expect(409);
      const summary = {
        id: held.body.bookingId,
        code: held.body.code,
        status: 'ROOM_HELD',
        holdExpiresAt: held.body.holdExpiresAt,
      };
      expect(conflict.body).toMatchObject({
        code: 'ACTIVE_BOOKING_EXISTS',
        existingBooking: summary,
      });
      const active = await client
        .get('/api/v1/bookings/active-hold')
        .set(headers)
        .expect(200);
      expect(active.body).toEqual({ activeBooking: summary });
      await http()
        .get('/api/v1/bookings/active-hold')
        .expect(200)
        .expect({ activeBooking: null });
      const pending = await http()
        .post('/api/v1/bookings/details')
        .send({
          holdToken: held.body.holdToken,
          guestName: 'Guest',
          guestEmail: 'guest@example.test',
          guestPhone: '0900000000',
        })
        .expect(200);
      const resumed = await client
        .post('/api/v1/bookings/hold')
        .set(headers)
        .send(body)
        .expect(201);
      expect(resumed.body).toEqual(pending.body);
      const pendingConflict = await client
        .post('/api/v1/bookings/hold')
        .set(headers)
        .send({ ...body, adultCount: 1 })
        .expect(409);
      expect(pendingConflict.body).toMatchObject({
        code: 'ACTIVE_BOOKING_EXISTS',
        existingBooking: { ...summary, status: 'PENDING_DEPOSIT' },
      });
      await client
        .post(`/api/v1/bookings/${held.body.bookingId}/cancel`)
        .set(headers)
        .send(role ? {} : { code: held.body.code })
        .expect(201);
      await client
        .post('/api/v1/bookings/hold')
        .set(headers)
        .send({ ...body, checkOut: '2093-04-04' })
        .expect(201);
    },
  );

  it.each(['expired', 'confirmed'])(
    'frees the principal slot after %s without waiting for a sweep',
    async (state) => {
      const headers = {
        'x-dev-role': 'CUSTOMER',
        'x-dev-user-id': String(new Types.ObjectId()),
      };
      const held = await http()
        .post('/api/v1/bookings/hold')
        .set(headers)
        .send(holdBody(roomA, '2093-04-01', '2093-04-03'))
        .expect(201);
      if (state === 'expired') {
        await holds.updateOne(
          { booking: new Types.ObjectId(held.body.bookingId) },
          { $set: { expiresAt: new Date(Date.now() - 1) } },
        );
      } else {
        await bookings.updateOne(
          { _id: held.body.bookingId },
          { $set: { status: 'CONFIRMED' } },
        );
      }
      await http()
        .post('/api/v1/bookings/hold')
        .set(headers)
        .send(holdBody(roomA, '2093-04-10', '2093-04-12'))
        .expect(201);
    },
  );

  it('atomically prevents simultaneous different checkouts across signed-in sessions', async () => {
    const headers = {
      'x-dev-role': 'CUSTOMER',
      'x-dev-user-id': String(new Types.ObjectId()),
    };
    const results = await Promise.all([
      http()
        .post('/api/v1/bookings/hold')
        .set(headers)
        .send(holdBody(roomA, '2093-04-01', '2093-04-03')),
      http()
        .post('/api/v1/bookings/hold')
        .set(headers)
        .send(holdBody(roomA, '2093-04-10', '2093-04-12')),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
    expect(results.find((result) => result.status === 409)?.body.code).toBe(
      'ACTIVE_BOOKING_EXISTS',
    );
    expect(
      await bookings.countDocuments({
        customer: new Types.ObjectId(headers['x-dev-user-id']),
      }),
    ).toBe(1);
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
    const limited = await http()
      .post('/api/v1/bookings/hold')
      .set('x-forwarded-for', ip)
      .send(holdBody(roomA, '2093-10-01', '2093-10-03'))
      .expect(429);
    expect(limited.body.message).toBe(
      'Bạn đã đạt giới hạn 3 lượt giữ phòng trong 30 phút cho phiên hoặc địa chỉ mạng này. Vui lòng chờ các lượt giữ phòng cũ ra khỏi khoảng 30 phút rồi thử lại.',
    );
  });
});
