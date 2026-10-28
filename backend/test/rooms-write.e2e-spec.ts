import { randomUUID } from 'node:crypto';
import { VersioningType, type INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { type Model, Types } from 'mongoose';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { Room } from '../src/modules/rooms/schemas/room.schema.js';
import { RoomType } from '../src/modules/room-types/schemas/room-type.schema.js';
import {
  Booking,
  BookingStatus,
} from '../src/modules/bookings/schemas/booking.schema.js';
import { RoomHold } from '../src/modules/bookings/schemas/room-hold.schema.js';
import { seedRooms } from '../src/modules/rooms/seed.js';
import { seedRoomTypes } from '../src/modules/room-types/seed.js';
import { seedAmenities } from '../src/modules/amenities/seed.js';
import { assertTestDatabase } from './test-database.js';

describe('UC48 room write API', () => {
  let app: INestApplication;
  let rooms: Model<Room>;
  let types: Model<RoomType>;
  let bookings: Model<Booking>;
  let holds: Model<RoomHold>;
  let active: string;
  let inactive: string;
  let id: string;
  const prefix = 'UC48-E2E-';
  const originalUri = process.env.MONGODB_URI;
  const manager = { 'x-dev-role': 'MANAGER' };
  const http = () => request(app.getHttpServer());
  const payload = () => ({
    roomNumber: prefix + '101',
    floor: 0,
    roomType: active,
    notes: ' note ',
  });
  beforeAll(async () => {
    assertTestDatabase(originalUri);
    // Each invocation owns this database; no shared development data or suite ordering dependency.
    const uri = new URL(originalUri!);
    uri.pathname = `/hms_uc48_${randomUUID().replaceAll('-', '')}_test`;
    process.env.MONGODB_URI = uri.toString();
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    await app.init();
    rooms = app.get(getModelToken(Room.name));
    types = app.get(getModelToken(RoomType.name));
    bookings = app.get(getModelToken(Booking.name));
    holds = app.get(getModelToken(RoomHold.name));
    await Promise.all([
      rooms.init(),
      types.init(),
      bookings.init(),
      holds.init(),
    ]);
    const type = { adultCapacity: 2, childCapacity: 0, basePrice: 850000 };
    active = String(
      (await types.create({ ...type, name: prefix + 'Active' }))._id,
    );
    inactive = String(
      (
        await types.create({
          ...type,
          name: prefix + 'Inactive',
          isActive: false,
        })
      )._id,
    );
  }, 60000);
  afterAll(async () => {
    // Delete only this suite's fixtures, never another module's collection.
    const fixtureBookings = bookings
      ? await bookings
          .find({ code: { $regex: '^' + prefix } })
          .select('_id')
          .lean()
      : [];
    if (holds)
      await holds.deleteMany({
        booking: { $in: fixtureBookings.map((row) => row._id) },
      });
    if (bookings)
      await bookings.deleteMany({
        _id: { $in: fixtureBookings.map((row) => row._id) },
      });
    if (rooms) await rooms.deleteMany({ roomNumber: { $regex: '^' + prefix } });
    if (types) await types.deleteMany({ name: { $regex: '^' + prefix } });
    await app?.close();
    if (originalUri === undefined) delete process.env.MONGODB_URI;
    else process.env.MONGODB_URI = originalUri;
  });
  it('requires authentication and rejects the four other roles on every new endpoint', async () => {
    for (const role of [
      undefined,
      'CUSTOMER',
      'RECEPTIONIST',
      'SERVICE_STAFF',
      'OPERATIONS_STAFF',
    ]) {
      const headers = role ? { 'x-dev-role': role } : {};
      const status = role ? 403 : 401;
      await http()
        .post('/api/v1/rooms')
        .set(headers)
        .send(payload())
        .expect(status);
      await http()
        .patch('/api/v1/rooms/' + new Types.ObjectId())
        .set(headers)
        .send({ notes: 'x' })
        .expect(status);
      await http()
        .get('/api/v1/rooms/' + new Types.ObjectId())
        .set(headers)
        .expect(status);
      await http()
        .get('/api/v1/room-types/options')
        .set(headers)
        .expect(status);
    }
  });
  it('creates with defaults, trims values, lists and loads detail', async () => {
    const result = await http()
      .post('/api/v1/rooms')
      .set(manager)
      .send({ ...payload(), roomNumber: ' ' + payload().roomNumber + ' ' })
      .expect(201);
    id = result.body.id;
    expect(result.body).toEqual({
      id,
      roomNumber: prefix + '101',
      floor: 0,
      roomType: { id: active, name: prefix + 'Active', isActive: true },
      status: 'AVAILABLE',
      notes: 'note',
      isActive: true,
    });
    expect(
      (
        await http()
          .get('/api/v1/rooms/' + id)
          .set(manager)
          .expect(200)
      ).body,
    ).toEqual(result.body);
    expect(
      (
        await http()
          .get('/api/v1/rooms')
          .set(manager)
          .query({ search: prefix })
          .expect(200)
      ).body.items,
    ).toContainEqual(result.body);
  });
  it.each([
    { roomNumber: undefined },
    { roomNumber: ' ' },
    { roomType: undefined },
    { roomType: null },
    { roomType: [] },
    { roomType: 'bad' },
    { status: 'RESERVED' },
    { status: null },
    { floor: 1.5 },
    { notes: null },
    { isActive: 'false' },
    { unexpected: true },
    { _id: 'bad' },
  ])('rejects invalid create %j and writes nothing', async (change) => {
    const before = await rooms.countDocuments();
    const result = await http()
      .post('/api/v1/rooms')
      .set(manager)
      .send({ ...payload(), roomNumber: prefix + 'Invalid', ...change })
      .expect(400);
    expect(result.body).toMatchObject({
      statusCode: 400,
      error: 'Bad Request',
      path: '/api/v1/rooms',
      timestamp: expect.any(String),
    });
    expect(await rooms.countDocuments()).toBe(before);
  });
  it('rejects inactive/missing types and reports the missing-active-type precondition', async () => {
    for (const roomType of [inactive, String(new Types.ObjectId())])
      await http()
        .post('/api/v1/rooms')
        .set(manager)
        .send({ ...payload(), roomNumber: prefix + 'BadType', roomType })
        .expect(400);
    await types.updateOne({ _id: active }, { isActive: false });
    try {
      const result = await http()
        .post('/api/v1/rooms')
        .set(manager)
        .send({ ...payload(), roomNumber: prefix + 'NoTypes' })
        .expect(400);
      expect(result.body.message).toContain('Chưa có loại phòng hoạt động');
    } finally {
      await types.updateOne({ _id: active }, { isActive: true });
    }
    expect(await rooms.countDocuments()).toBe(1);
  });
  it('maps exact duplicates and concurrent unique-index races to 409; preserves case sensitivity', async () => {
    await http().post('/api/v1/rooms').set(manager).send(payload()).expect(409);
    const race = await Promise.all(
      [1, 2].map(() =>
        http()
          .post('/api/v1/rooms')
          .set(manager)
          .send({ ...payload(), roomNumber: prefix + 'Race' }),
      ),
    );
    expect(race.map((result) => result.status).sort()).toEqual([201, 409]);
    await http()
      .post('/api/v1/rooms')
      .set(manager)
      .send({ ...payload(), roomNumber: prefix + 'race' })
      .expect(201);
    await http()
      .patch('/api/v1/rooms/' + id)
      .set(manager)
      .send({ roomNumber: prefix + 'Race' })
      .expect(409);
  });
  it('partially updates without overwriting other fields and freely changes all four statuses', async () => {
    const before = (
      await http()
        .get('/api/v1/rooms/' + id)
        .set(manager)
        .expect(200)
    ).body;
    const result = await http()
      .patch('/api/v1/rooms/' + id)
      .set(manager)
      .send({ notes: ' new ', floor: -1 })
      .expect(200);
    expect(result.body).toEqual({ ...before, notes: 'new', floor: -1 });
    for (const status of ['AVAILABLE', 'OCCUPIED', 'CLEANING', 'MAINTENANCE'])
      expect(
        (
          await http()
            .patch('/api/v1/rooms/' + id)
            .set(manager)
            .send({ status })
            .expect(200)
        ).body.status,
      ).toBe(status);
  });
  it.each([
    {},
    { _id: 'x' },
    { createdAt: 'now' },
    { updatedAt: 'now' },
    { roomType: null },
    { roomType: [] },
    { roomType: 'bad' },
    { status: 'UNKNOWN' },
  ])('rejects empty or invalid PATCH %j', async (body) => {
    const before = await rooms.findById(id).lean();
    await http()
      .patch('/api/v1/rooms/' + id)
      .set(manager)
      .send(body)
      .expect(400);
    expect(await rooms.findById(id).lean()).toEqual(before);
  });
  it('keeps bookings and holds exactly intact when deactivating; no DELETE', async () => {
    const booking = await bookings.create({
      code: prefix + 'Booking',
      guestName: 'UC48',
      guestEmail: 'uc48@example.test',
      guestPhone: '0900000000',
      rooms: [id],
      checkIn: new Date('2030-01-01'),
      checkOut: new Date('2030-01-02'),
      adultCount: 1,
      status: BookingStatus.Confirmed,
      roomTotal: 850000,
      depositAmount: 0,
    });
    await holds.create({
      booking: booking._id,
      rooms: [id],
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
      expiresAt: new Date(Date.now() + 3600000),
    });
    const before = await bookings.findById(booking._id).lean();
    const holdBefore = await holds.findOne({ booking: booking._id }).lean();
    for (let attempt = 0; attempt < 2; attempt++)
      expect(
        (
          await http()
            .patch('/api/v1/rooms/' + id)
            .set(manager)
            .send({ isActive: false })
            .expect(200)
        ).body.isActive,
      ).toBe(false);
    expect(await bookings.findById(booking._id).lean()).toEqual(before);
    expect(await holds.findOne({ booking: booking._id }).lean()).toEqual(
      holdBefore,
    );
    expect(await rooms.findById(id)).not.toBeNull();
    expect(
      (
        await http()
          .get('/api/v1/rooms')
          .set(manager)
          .query({ search: prefix + '101', isActive: false })
          .expect(200)
      ).body.items[0].id,
    ).toBe(id);
    await http()
      .delete('/api/v1/rooms/' + id)
      .set(manager)
      .expect(404);
  });
  it('allows edits with inactive current type, but reactivation requires active current/replacement type', async () => {
    await types.updateOne({ _id: active }, { isActive: false });
    await http()
      .patch('/api/v1/rooms/' + id)
      .set(manager)
      .send({ notes: 'Inactive type editable', status: 'AVAILABLE' })
      .expect(200);
    await http()
      .patch('/api/v1/rooms/' + id)
      .set(manager)
      .send({ isActive: true })
      .expect(400);
    await http()
      .patch('/api/v1/rooms/' + id)
      .set(manager)
      .send({ roomType: inactive })
      .expect(400);
    await types.updateOne({ _id: inactive }, { isActive: true });
    const result = await http()
      .patch('/api/v1/rooms/' + id)
      .set(manager)
      .send({ roomType: inactive, isActive: true })
      .expect(200);
    expect(result.body).toMatchObject({
      isActive: true,
      roomType: { id: inactive, isActive: true },
    });
    await types.updateOne({ _id: active }, { isActive: true });
  });
  it('returns 400 for invalid ids and 404 for missing rooms', async () => {
    for (const value of ['bad', String(new Types.ObjectId())]) {
      const expected = value === 'bad' ? 400 : 404;
      await http()
        .get('/api/v1/rooms/' + value)
        .set(manager)
        .expect(expected);
      await http()
        .patch('/api/v1/rooms/' + value)
        .set(manager)
        .send({ notes: 'x' })
        .expect(expected);
    }
  });
  it('returns every active RoomType option beyond 100, sorted and without inactive/private fields', async () => {
    await types.updateOne({ _id: inactive }, { isActive: false });
    await types.insertMany(
      Array.from({ length: 101 }, (_, index) => ({
        name: prefix + 'Option' + String(index).padStart(3, '0'),
        adultCapacity: 1,
        childCapacity: 0,
        basePrice: 1,
      })),
    );
    const result = await http()
      .get('/api/v1/room-types/options')
      .set(manager)
      .expect(200);
    expect(result.body).toHaveLength(102);
    expect(result.body.map((row: { name: string }) => row.name)).toEqual([
      prefix + 'Active',
      ...Array.from(
        { length: 101 },
        (_, index) => prefix + 'Option' + String(index).padStart(3, '0'),
      ),
    ]);
    expect(
      result.body.every(
        (row: object) => Object.keys(row).sort().join(',') === 'id,name',
      ),
    ).toBe(true);
  });
  it('runs room seeds twice without changing Manager edits', async () => {
    await seedAmenities(app);
    await seedRoomTypes(app);
    await seedRooms(app);
    const sample = await rooms.findOne({ roomNumber: '101' }).orFail();
    await http()
      .patch('/api/v1/rooms/' + sample._id)
      .set(manager)
      .send({ notes: 'Manager edited', floor: 9, isActive: false })
      .expect(200);
    const before = await rooms.findById(sample._id).lean();
    const count = await rooms.countDocuments();
    await seedRooms(app);
    await seedRooms(app);
    expect(await rooms.findById(sample._id).lean()).toEqual(before);
    expect(await rooms.countDocuments()).toBe(count);
  });
  it('documents all new routes and response/error contracts', () => {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle('UC48').build(),
    );
    expect(document.paths['/api/v1/rooms'].post?.responses).toHaveProperty(
      '201',
    );
    expect(document.paths['/api/v1/rooms'].post?.responses).toHaveProperty(
      '409',
    );
    expect(document.paths['/api/v1/rooms/{id}'].get?.responses).toHaveProperty(
      '404',
    );
    expect(
      document.paths['/api/v1/rooms/{id}'].patch?.responses,
    ).toHaveProperty('400');
    expect(document.paths['/api/v1/rooms/{id}'].delete).toBeUndefined();
    expect(
      document.paths['/api/v1/room-types/options'].get?.responses,
    ).toHaveProperty('200');
  });
});
