import {
  ValidationPipe,
  VersioningType,
  type INestApplication,
} from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { Model, Types } from 'mongoose';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { Booking } from '../src/modules/bookings/schemas/booking.schema.js';
import { Issue } from '../src/modules/issues/schemas/issue.schema.js';
import { ServiceOrder } from '../src/modules/service-orders/schemas/service-order.schema.js';
import { Service } from '../src/modules/services/schemas/service.schema.js';
import { Task } from '../src/modules/tasks/schemas/task.schema.js';
import { User } from '../src/modules/users/schemas/user.schema.js';
import { assertTestDatabase } from './test-database.js';

describe('UC34 service task reports (HTTP + MongoDB)', () => {
  let app: INestApplication;
  let tasks: Model<Task>;
  let issues: Model<Issue>;
  let orders: Model<ServiceOrder>;
  let services: Model<Service>;
  let bookings: Model<Booking>;
  let users: Model<User>;
  const staff = new Types.ObjectId();
  const customer = new Types.ObjectId();
  const task = new Types.ObjectId();
  const order = new Types.ObjectId();
  const service = new Types.ObjectId();
  const booking = new Types.ObjectId();
  const headers = {
    'x-dev-role': 'SERVICE_STAFF',
    'x-dev-user-id': String(staff),
  };
  const payload = {
    title: ' Damaged item ',
    category: ' Service ',
    description: ' Item damaged during delivery ',
  };
  const path = `/api/v1/issues/service-tasks/${task}`;
  const post = (body: object = payload, auth = headers) =>
    request(app.getHttpServer()).post(path).set(auth).send(body);
  const get = (auth = headers) =>
    request(app.getHttpServer()).get(`${path}/context`).set(auth);

  beforeAll(async () => {
    assertTestDatabase(process.env.MONGODB_URI);
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    tasks = app.get(getModelToken(Task.name));
    issues = app.get(getModelToken(Issue.name));
    orders = app.get(getModelToken(ServiceOrder.name));
    services = app.get(getModelToken(Service.name));
    bookings = app.get(getModelToken(Booking.name));
    users = app.get(getModelToken(User.name));
    await users.create({
      _id: staff,
      email: `${staff}@uc34.test`,
      fullName: 'Private staff',
      role: 'SERVICE_STAFF',
      isActive: true,
    });
    await services.create({
      _id: service,
      name: `UC34-${service}`,
      unit: 'item',
      billable: false,
      isActive: false,
    });
    await bookings.create({
      _id: booking,
      code: `UC34-${booking}`,
      customer,
      guestName: 'Private guest',
      guestEmail: 'private@uc34.test',
      guestPhone: '0900000000',
      rooms: [new Types.ObjectId()],
      checkIn: new Date('2020-01-01'),
      checkOut: new Date('2020-01-02'),
      guests: 1,
      status: 'CHECKED_OUT',
      roomTotal: 0,
      depositAmount: 0,
    });
    await orders.create({
      _id: order,
      customer,
      booking,
      service,
      serviceName: 'Delivery',
      unit: 'item',
      quantity: 1,
      unitPriceVND: 0,
      amount: 0,
      requestedTime: new Date(),
      reviewStatus: 'ACCEPTED',
      executionStatus: 'IN_PROGRESS',
      linkedTask: task,
    });
    await tasks.create({
      _id: task,
      title: 'Deliver item',
      taskType: 'SERVICE_ORDER_EXECUTION',
      priority: 'NORMAL',
      status: 'IN_PROGRESS',
      assignedTo: staff,
      sourceType: 'SERVICE_ORDER',
      sourceId: order,
    });
  });

  beforeEach(async () => {
    await tasks.updateOne(
      { _id: task },
      {
        status: 'IN_PROGRESS',
        assignedTo: staff,
        sourceType: 'SERVICE_ORDER',
        taskType: 'SERVICE_ORDER_EXECUTION',
        sourceId: order,
      },
    );
    await orders.updateOne(
      { _id: order },
      { linkedTask: task, reviewStatus: 'ACCEPTED' },
    );
    await bookings.updateOne({ _id: booking }, { customer, isActive: true });
    await users.updateOne(
      { _id: staff },
      { role: 'SERVICE_STAFF', isActive: true },
    );
  });

  afterAll(async () => {
    if (!app) return;
    if (issues) await issues.deleteMany({ reporter: staff });
    if (tasks) await tasks.deleteOne({ _id: task });
    if (orders) await orders.deleteOne({ _id: order });
    if (bookings) await bookings.deleteOne({ _id: booking });
    if (services) await services.deleteOne({ _id: service });
    if (users) await users.deleteOne({ _id: staff });
    await app.close();
  });

  it('returns only safe context even for an inactive service and checked-out booking', async () => {
    const response = await get().expect(200);
    expect(response.body).toEqual({
      taskId: String(task),
      taskTitle: 'Deliver item',
      taskStatus: 'IN_PROGRESS',
      serviceOrderId: String(order),
      service: { id: String(service), name: `UC34-${service}`, unit: 'item' },
      booking: { id: String(booking), code: `UC34-${booking}` },
    });
  });

  it('persists trusted source refs without changing task/order or creating resolution work', async () => {
    const beforeTask = await tasks.findById(task).lean();
    const beforeOrder = await orders.findById(order).lean();
    const count = await tasks.countDocuments();
    const response = await post().expect(201);
    const saved = await issues.findById(response.body.id).lean();
    expect(saved).toMatchObject({
      title: 'Damaged item',
      category: 'Service',
      description: 'Item damaged during delivery',
      priority: 'NORMAL',
      status: 'PENDING_REVIEW',
      reporter: staff,
      booking,
      serviceOrder: order,
      sourceTask: task,
      service,
    });
    expect(saved?.reportedAt).toBeInstanceOf(Date);
    expect(saved?.linkedTask).toBeUndefined();
    expect(saved?.room).toBeUndefined();
    expect(response.body).not.toHaveProperty('reporter');
    expect(response.body).not.toHaveProperty('requestFingerprint');
    expect(await tasks.countDocuments()).toBe(count);
    expect(await tasks.findById(task).lean()).toEqual(beforeTask);
    expect(await orders.findById(order).lean()).toEqual(beforeOrder);
    for (const role of ['RECEPTIONIST', 'MANAGER', 'CUSTOMER']) {
      const read = await request(app.getHttpServer())
        .get(`/api/v1/issues/${response.body.id}`)
        .set({ 'x-dev-role': role, 'x-dev-user-id': String(customer) })
        .expect(200);
      expect(read.body).toMatchObject({
        serviceOrderId: String(order),
        sourceTaskId: String(task),
        serviceId: String(service),
        linkedTasks: [],
      });
      expect(read.body).not.toHaveProperty('reporter');
    }
  });

  it('requires authentication and the exact service staff role', async () => {
    await request(app.getHttpServer()).get(`${path}/context`).expect(401);
    await request(app.getHttpServer()).post(path).send(payload).expect(401);
    for (const role of [
      'CUSTOMER',
      'OPERATIONS_STAFF',
      'RECEPTIONIST',
      'MANAGER',
    ]) {
      await get({ ...headers, 'x-dev-role': role }).expect(403);
      await post(payload, { ...headers, 'x-dev-role': role }).expect(403);
    }
    await users.updateOne({ _id: staff }, { isActive: false });
    await get().expect(403);
    await post().expect(403);
    await users.updateOne(
      { _id: staff },
      { isActive: true, role: 'OPERATIONS_STAFF' },
    );
    await post().expect(403);
  });

  it.each([
    { assignedTo: new Types.ObjectId() },
    { sourceType: 'ISSUE' },
    { taskType: 'ISSUE_RESOLUTION' },
    { sourceId: new Types.ObjectId() },
  ])('hides unavailable or foreign task %j', async (change) => {
    await tasks.updateOne({ _id: task }, change);
    await get().expect(404);
    await post().expect(404);
  });

  it('hides malformed and missing tasks', async () => {
    for (const id of ['bad', String(new Types.ObjectId())]) {
      await request(app.getHttpServer())
        .get(`/api/v1/issues/service-tasks/${id}/context`)
        .set(headers)
        .expect(404);
      await request(app.getHttpServer())
        .post(`/api/v1/issues/service-tasks/${id}`)
        .set(headers)
        .send(payload)
        .expect(404);
    }
  });

  it.each([
    { linkedTask: new Types.ObjectId() },
    { linkedTask: null },
    { reviewStatus: 'PENDING_REVIEW' },
    { reviewStatus: 'ACCEPTING' },
    { reviewStatus: 'REJECTED' },
  ])('requires accepted linked source order %j', async (change) => {
    await orders.updateOne({ _id: order }, change);
    await get().expect(404);
    await post().expect(404);
  });

  it.each([{ customer: new Types.ObjectId() }, { isActive: false }])(
    'requires active consistent booking %j',
    async (change) => {
      await bookings.updateOne({ _id: booking }, change);
      await get().expect(404);
      await post().expect(404);
    },
  );

  it('requires existing service and booking without trusting snapshots', async () => {
    const original = await services.findById(service).lean();
    await services.deleteOne({ _id: service });
    try {
      await get().expect(404);
      await post().expect(404);
    } finally {
      await services.create(original);
    }
    const originalBooking = await bookings.findById(booking).lean();
    await bookings.deleteOne({ _id: booking });
    try {
      await get().expect(404);
      await post().expect(404);
    } finally {
      await bookings.create(originalBooking);
    }
  });

  it.each(['ASSIGNED', 'COMPLETED'])(
    'rejects new reports when task is %s',
    async (status) => {
      await tasks.updateOne({ _id: task }, { status });
      await get().expect(409);
      await post().expect(409);
    },
  );

  it.each([
    { title: '' },
    { category: ' ' },
    { category: 123 },
    { description: '' },
    { description: 'x'.repeat(5001) },
    { requestId: 'bad' },
    { requestId: null },
    { reporter: String(customer) },
    { bookingId: String(booking) },
    { sourceTaskId: String(task) },
    { serviceOrderId: String(order) },
    { serviceId: String(service) },
    { assigneeId: String(staff) },
    { customer: String(customer) },
    { priority: 'URGENT' },
    { status: 'CLOSED' },
    { roomId: String(new Types.ObjectId()) },
  ])('rejects invalid/spoofed input %j', async (change) => {
    const count = await issues.countDocuments({ reporter: staff });
    await post({ ...payload, ...change }).expect(400);
    expect(await issues.countDocuments({ reporter: staff })).toBe(count);
  });

  it('atomically deduplicates races, conflicts on changed payload and retries after completion', async () => {
    const requestId = randomUUID();
    const before = await issues.countDocuments({ reporter: staff });
    const responses = await Promise.all(
      Array.from({ length: 8 }, () =>
        post({ ...payload, requestId }).expect(201),
      ),
    );
    expect(new Set(responses.map((response) => response.body.id)).size).toBe(1);
    expect(await issues.countDocuments({ reporter: staff })).toBe(before + 1);
    await post({ ...payload, requestId, description: 'Different' }).expect(409);
    await tasks.updateOne({ _id: task }, { status: 'COMPLETED' });
    const retry = await post({ ...payload, requestId }).expect(201);
    expect(retry.body).toEqual(responses[0].body);
    await post({ ...payload, requestId: randomUUID() }).expect(409);
    await tasks.updateOne({ _id: task }, { assignedTo: new Types.ObjectId() });
    await post({ ...payload, requestId }).expect(404);
  });

  it('allows repeated legitimate reports without a requestId', async () => {
    const first = await post().expect(201);
    const second = await post().expect(201);
    expect(first.body.id).not.toBe(second.body.id);
  });
});
