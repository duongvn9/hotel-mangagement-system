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
import { Issue } from '../src/modules/issues/schemas/issue.schema.js';
import { Room } from '../src/modules/rooms/schemas/room.schema.js';
import { Task } from '../src/modules/tasks/schemas/task.schema.js';
import { assertTestDatabase } from './test-database.js';

describe('Report issue (e2e)', () => {
  let app: INestApplication;
  let bookings: Model<Booking>;
  let rooms: Model<Room>;
  let issues: Model<Issue>;
  let tasks: Model<Task>;
  const owner = new Types.ObjectId();
  const other = new Types.ObjectId();
  const booking = new Types.ObjectId();
  const foreign = new Types.ObjectId();
  const room = new Types.ObjectId();
  const unrelated = new Types.ObjectId();
  const missing = new Types.ObjectId();
  const customer = { 'x-dev-role': 'CUSTOMER', 'x-dev-user-id': String(owner) };
  const payload = {
    title: ' Broken lamp ',
    category: ' Lighting ',
    description: ' No light ',
    bookingId: String(booking),
  };
  const post = (body: object) =>
    request(app.getHttpServer())
      .post('/api/v1/issues')
      .set(customer)
      .send(body);

  beforeAll(async () => {
    assertTestDatabase(process.env.MONGODB_URI);
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    await app.init();
    bookings = app.get(getModelToken(Booking.name));
    rooms = app.get(getModelToken(Room.name));
    issues = app.get(getModelToken(Issue.name));
    tasks = app.get(getModelToken(Task.name));
    await rooms.create([
      {
        _id: room,
        roomNumber: `ISS-${room}`,
        floor: 1,
        roomType: new Types.ObjectId(),
      },
      {
        _id: unrelated,
        roomNumber: `ISS-${unrelated}`,
        floor: 1,
        roomType: new Types.ObjectId(),
      },
    ]);
    await bookings.create(
      [booking, foreign].map((_id) => ({
        _id,
        code: `ISS-${_id}`,
        customer: _id.equals(booking) ? owner : other,
        guestName: 'Issue test',
        guestEmail: 'same@example.test',
        guestPhone: '0900000000',
        rooms: [room, missing],
        checkIn: new Date('2020-01-01'),
        checkOut: new Date('2020-01-02'),
        guests: 1,
        status: BookingStatus.CheckedOut,
        roomTotal: 100000,
        depositAmount: 100000,
      })),
    );
  });

  beforeEach(async () => {
    await bookings.updateOne(
      { _id: booking },
      { status: BookingStatus.CheckedOut, isActive: true, customer: owner },
    );
    await rooms.updateOne({ _id: room }, { isActive: true });
  });

  afterAll(async () => {
    if (!app) return;
    await issues.deleteMany({ reporter: { $in: [owner, other] } });
    await bookings.deleteMany({ _id: { $in: [booking, foreign] } });
    await rooms.deleteMany({ _id: { $in: [room, unrelated] } });
    await app.close();
  });

  it('persists trusted context and pending review without a task or closed timestamp', async () => {
    const before = await tasks.countDocuments();
    const response = await post({ ...payload, roomId: String(room) }).expect(
      201,
    );
    const saved = await issues.findById(response.body.id).lean();
    expect(saved).toMatchObject({
      title: 'Broken lamp',
      category: 'Lighting',
      description: 'No light',
      status: 'PENDING_REVIEW',
      priority: 'NORMAL',
    });
    expect(saved?.reporter.equals(owner)).toBe(true);
    expect(saved?.booking.equals(booking)).toBe(true);
    expect(saved?.room?.equals(room)).toBe(true);
    expect(saved?.closedAt).toBeUndefined();
    expect(await tasks.countDocuments()).toBe(before);
    expect(response.body.reporter).toBeUndefined();
  });

  it('accepts booking-only context', async () => {
    const response = await post(payload).expect(201);
    expect(response.body.roomId).toBeUndefined();
  });

  it('returns the same 404 for a missing and another customer booking', async () => {
    const absent = await post({
      ...payload,
      bookingId: String(new Types.ObjectId()),
    }).expect(404);
    const denied = await post({
      ...payload,
      bookingId: String(foreign),
    }).expect(404);
    expect(absent.body.message).toEqual(denied.body.message);
    await request(app.getHttpServer())
      .post('/api/v1/issues')
      .set({ ...customer, 'x-dev-user-id': String(other) })
      .send({ ...payload, bookingId: String(foreign) })
      .expect(201);
  });

  it.each([
    { isActive: false },
    { status: BookingStatus.Cancelled },
    { customer: other },
  ])('rejects revoked context %j', async (change) => {
    await bookings.updateOne({ _id: booking }, change);
    await post(payload).expect(404);
  });

  it.each([
    BookingStatus.PendingDeposit,
    BookingStatus.Confirmed,
    BookingStatus.CheckedIn,
    BookingStatus.CheckedOut,
  ])('allows relevant %s context', async (status) => {
    await bookings.updateOne({ _id: booking }, { status });
    await post(payload).expect(201);
  });

  it('rejects unrelated, missing and inactive rooms', async () => {
    for (const id of [unrelated, missing])
      await post({ ...payload, roomId: String(id) }).expect(404);
    await rooms.updateOne({ _id: room }, { isActive: false });
    await post({ ...payload, roomId: String(room) }).expect(404);
  });

  it('rejects guests, staff and unsupported input', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/issues')
      .send(payload)
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/v1/issues')
      .set({ ...customer, 'x-dev-role': 'RECEPTIONIST' })
      .send(payload)
      .expect(403);
    await post({ ...payload, bookingId: undefined }).expect(400);
    await post({ ...payload, serviceOrderId: String(room) }).expect(400);
  });
});
