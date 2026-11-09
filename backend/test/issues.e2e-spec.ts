import { VersioningType, type INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { Model, Types } from 'mongoose';
import { randomUUID } from 'node:crypto';
import { ServiceOrder } from '../src/modules/service-orders/schemas/service-order.schema.js';
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
  const createdIssueIds: string[] = [];
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
      .send({ requestId: randomUUID(), ...body })
      .expect((response) => {
        if (response.body.id) createdIssueIds.push(response.body.id);
      });

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
        adultCount: 1,
        status: BookingStatus.CheckedIn,
        roomTotal: 100000,
        depositAmount: 100000,
      })),
    );
  });

  beforeEach(async () => {
    await bookings.updateOne(
      { _id: booking },
      { status: BookingStatus.CheckedIn, isActive: true, customer: owner },
    );
    await rooms.updateOne({ _id: room }, { isActive: true });
  });

  afterAll(async () => {
    if (!app) return;
    await issues.deleteMany({ _id: { $in: createdIssueIds } });
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

  it('deduplicates concurrent Mongo inserts and safely replays after eligibility changes', async () => {
    const input = { ...payload, requestId: randomUUID() };
    const responses = await Promise.all([
      post(input).expect(201),
      post(input).expect(201),
    ]);
    expect(responses[0].body).toEqual(responses[1].body);
    expect(
      await issues.countDocuments({
        reporter: owner,
        requestId: input.requestId,
      }),
    ).toBe(1);
    await post({ ...input, title: 'Different' }).expect(409);
    for (const change of [
      { status: BookingStatus.CheckedOut },
      { isActive: false },
      { customer: other },
    ]) {
      await bookings.updateOne({ _id: booking }, change);
      const replay = await post(input).expect(201);
      expect(replay.body).toEqual(responses[0].body);
      await post(payload).expect(404);
      await get(`/${replay.body.id}`).expect(200);
      await get(`/${replay.body.id}`, 'CUSTOMER', other).expect(404);
    }
  });

  it('returns eligible context and accepts rejected owned service orders only', async () => {
    const orders = app.get<Model<ServiceOrder>>(
      getModelToken(ServiceOrder.name),
    );
    const ids = [
      new Types.ObjectId(),
      new Types.ObjectId(),
      new Types.ObjectId(),
    ];
    try {
      await orders.create(
        ids.map((_id, index) => ({
          _id,
          booking: index === 2 ? foreign : booking,
          customer: index === 1 ? other : owner,
          service: new Types.ObjectId(),
          serviceName: 'Laundry',
          quantity: 1,
          unitPriceVND: 1000,
          amount: 1000,
          requestedTime: new Date(),
          reviewStatus: 'REJECTED',
        })),
      );
      const context = await get('/report-context').expect(200);
      expect(context.body.items).toEqual([
        {
          id: String(booking),
          code: `ISS-${booking}`,
          status: 'CHECKED_IN',
          checkIn: '2020-01-01T00:00:00.000Z',
          checkOut: '2020-01-02T00:00:00.000Z',
          rooms: [{ id: String(room), roomNumber: `ISS-${room}` }],
          serviceOrders: [
            {
              id: String(ids[0]),
              serviceName: 'Laundry',
              reviewStatus: 'REJECTED',
              executionStatus: 'NOT_STARTED',
            },
          ],
        },
      ]);
      const response = await post({
        ...payload,
        roomId: String(room),
        serviceOrderId: String(ids[0]),
      }).expect(201);
      expect(response.body.serviceOrderId).toBe(String(ids[0]));
      for (const id of ids.slice(1))
        await post({ ...payload, serviceOrderId: String(id) }).expect(404);
      await bookings.updateOne(
        { _id: booking },
        { status: BookingStatus.CheckedOut },
      );
      expect((await get('/report-context').expect(200)).body).toEqual({
        items: [],
      });
    } finally {
      await orders.deleteMany({ _id: { $in: ids } });
    }
  });

  it('keeps legacy self reports private and staff reports scoped to current ownership', async () => {
    const response = await post(payload).expect(201);
    await issues.updateOne(
      { _id: response.body.id },
      { $unset: { requestId: 1, requestFingerprint: 1 } },
    );
    await bookings.updateOne({ _id: booking }, { customer: other });
    await get(`/${response.body.id}`).expect(200);
    await get(`/${response.body.id}`, 'CUSTOMER', other).expect(404);
    await issues.updateOne(
      { _id: response.body.id },
      { sourceTask: new Types.ObjectId() },
    );
    await get(`/${response.body.id}`).expect(404);
    await get(`/${response.body.id}`, 'CUSTOMER', other).expect(200);
    await bookings.updateOne({ _id: booking }, { isActive: false });
    await get(`/${response.body.id}`, 'CUSTOMER', other).expect(404);
  });

  it('keeps authorized room labels after checkout and room deactivation for both origins', async () => {
    const own = await post({ ...payload, roomId: String(room) }).expect(201);
    const staff = await post({ ...payload, roomId: String(room) }).expect(201);
    await issues.updateOne(
      { _id: staff.body.id },
      {
        sourceTask: new Types.ObjectId(),
        reporter: other,
        reviewNotes: 'Private review',
        reviewedBy: other,
        assignmentAssignee: other,
        assignmentInstructions: 'Private instructions',
      },
    );
    await bookings.updateOne(
      { _id: booking },
      { status: BookingStatus.CheckedOut },
    );
    await rooms.updateOne({ _id: room }, { isActive: false });
    for (const id of [own.body.id, staff.body.id]) {
      const detail = await get(`/${id}`).expect(200);
      expect(detail.body.roomNumber).toBe(`ISS-${room}`);
      expect(detail.body.roomId).toBe(String(room));
      for (const key of [
        'reviewNotes',
        'reviewedBy',
        'assigneeId',
        'assignmentInstructions',
        'resolutionTasks',
        'reassignmentHistory',
      ])
        expect(detail.body).not.toHaveProperty(key);
      await get(`/${id}`, 'CUSTOMER', other).expect(404);
    }
    const list = await get('').expect(200);
    for (const id of [own.body.id, staff.body.id])
      expect(
        list.body.items.find((item: { id: string }) => item.id === id)
          ?.roomNumber,
      ).toBe(`ISS-${room}`);
    const denied = await get('', 'CUSTOMER', other).expect(200);
    expect(denied.body.items).toEqual([]);
    await bookings.updateOne({ _id: booking }, { isActive: false });
    await get(`/${own.body.id}`).expect(200);
    await get(`/${staff.body.id}`).expect(404);
    await bookings.updateOne(
      { _id: booking },
      { isActive: true, customer: other },
    );
    await get(`/${own.body.id}`).expect(200);
    await get(`/${own.body.id}`, 'CUSTOMER', other).expect(404);
    await get(`/${staff.body.id}`).expect(404);
    await get(`/${staff.body.id}`, 'CUSTOMER', other).expect(200);
  });

  it('returns null room labels for booking-only and missing room references', async () => {
    const response = await post(payload).expect(201);
    expect(
      (await get(`/${response.body.id}`).expect(200)).body.roomNumber,
    ).toBeNull();
    await issues.updateOne({ _id: response.body.id }, { room: missing });
    const detail = await get(`/${response.body.id}`).expect(200);
    expect(detail.body.roomNumber).toBeNull();
    expect(detail.body.roomId).toBe(String(missing));
    const list = await get('').expect(200);
    expect(
      list.body.items.find(
        (item: { id: string }) => item.id === response.body.id,
      )?.roomNumber,
    ).toBeNull();
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
      .send({ ...payload, requestId: randomUUID(), bookingId: String(foreign) })
      .expect(201)
      .expect((response) => createdIssueIds.push(response.body.id));
  });

  it.each([
    { isActive: false },
    { status: BookingStatus.Cancelled },
    { customer: other },
  ])('rejects revoked context %j', async (change) => {
    await bookings.updateOne({ _id: booking }, change);
    await post(payload).expect(404);
  });

  it.each(
    Object.values(BookingStatus).filter(
      (status) => status !== BookingStatus.CheckedIn,
    ),
  )('rejects non-checked-in %s context', async (status) => {
    await bookings.updateOne({ _id: booking }, { status });
    await post(payload).expect(404);
  });

  it('rejects unrelated, missing and inactive rooms', async () => {
    for (const id of [unrelated, missing])
      await post({ ...payload, roomId: String(id) }).expect(404);
    await rooms.updateOne({ _id: room }, { isActive: false });
    await post({ ...payload, roomId: String(room) }).expect(404);
  });

  const get = (path: string, role = 'CUSTOMER', userId = owner) =>
    request(app.getHttpServer())
      .get(`/api/v1/issues${path}`)
      .set({ 'x-dev-role': role, 'x-dev-user-id': String(userId) });

  it('scopes real Mongo reads by current booking ownership, not reporter or email', async () => {
    const response = await post({
      ...payload,
      title: `Literal [${booking}].*`,
    }).expect(201);
    const id = response.body.id;
    const detail = await get(`/${id}`).expect(200);
    expect(detail.body).toEqual({
      ...response.body,
      roomNumber: null,
      linkedTasks: [],
      linkedTasksAvailable: false,
    });
    await get(`/${id}`, 'CUSTOMER', other).expect(404);
    const keyword = encodeURIComponent(`[${booking}].*`);
    const page = await get(
      `?keyword=${keyword}&category=Lighting&status=PENDING_REVIEW&priority=NORMAL&limit=1`,
    ).expect(200);
    expect(page.body.total).toBe(1);
    expect(page.body.items[0].id).toBe(id);
    expect(page.body.items[0]).not.toHaveProperty('reporter');
    const empty = await get(`?keyword=${keyword}`, 'CUSTOMER', other).expect(
      200,
    );
    expect(empty.body).toEqual({ items: [], total: 0, page: 1, limit: 20 });
    await bookings.updateOne({ _id: booking }, { customer: other });
    await get(`/${id}`).expect(200);
    await get(`/${id}`, 'CUSTOMER', other).expect(404);
    const retained = await get(`?keyword=${keyword}`).expect(200);
    expect(retained.body.total).toBe(1);
    await bookings.updateOne({ _id: booking }, { $unset: { customer: 1 } });
    await get(`/${id}`).expect(200);
    await get(`/${id}`, 'CUSTOMER', other).expect(404);
    for (const role of ['RECEPTIONIST', 'MANAGER']) {
      await get(`/${id}`, role).expect(200);
      const operational = await get(`?keyword=${keyword}`, role).expect(200);
      expect(operational.body.items[0].id).toBe(id);
    }
  });

  it('hides missing and inactive booking context with identical detail errors', async () => {
    const response = await post(payload).expect(201);
    const missingDetail = await get(`/${new Types.ObjectId()}`).expect(404);
    const malformed = await get('/bad-id').expect(404);
    expect(malformed.body.message).toEqual(missingDetail.body.message);
    await bookings.updateOne({ _id: booking }, { isActive: false });
    await get(`/${response.body.id}`).expect(200);
    await issues.updateOne({ _id: response.body.id }, { booking: missing });
    await get(`/${response.body.id}`).expect(200);
  });

  it.each(['SERVICE_STAFF', 'OPERATIONS_STAFF'])(
    'denies issue reads to %s',
    async (role) => {
      await get('', role).expect(403);
      await get(`/${missing}`, role).expect(403);
    },
  );

  it('rejects unsupported custom-role dev headers before authentication', async () => {
    await get('', 'CUSTOM_READER').expect(400);
    await get(`/${missing}`, 'CUSTOM_READER').expect(400);
  });

  it('enforces read authentication and strict query validation', async () => {
    await request(app.getHttpServer()).get('/api/v1/issues').expect(401);
    await request(app.getHttpServer())
      .get(`/api/v1/issues/${missing}`)
      .expect(401);
    for (const query of [
      'page=0',
      'limit=101',
      'status=INVALID',
      'priority=CRITICAL',
      'keyword=',
      'reporter=x',
    ]) {
      await get(`?${query}`).expect(400);
    }
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
    await post({ ...payload, serviceOrderId: String(room) }).expect(404);
    await post({ ...payload, requestId: undefined }).expect(400);
  });
});
