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
import {
  Booking,
  BookingStatus,
} from '../src/modules/bookings/schemas/booking.schema.js';
import { Invoice } from '../src/modules/invoices/schemas/invoice.schema.js';
import { Issue } from '../src/modules/issues/schemas/issue.schema.js';
import { RoomType } from '../src/modules/room-types/schemas/room-type.schema.js';
import { Room } from '../src/modules/rooms/schemas/room.schema.js';
import { ServiceOrder } from '../src/modules/service-orders/schemas/service-order.schema.js';
import { Service } from '../src/modules/services/schemas/service.schema.js';
import { Task } from '../src/modules/tasks/schemas/task.schema.js';
import { User } from '../src/modules/users/schemas/user.schema.js';
import { assertTestDatabase } from './test-database.js';

describe('Vu persisted cross-module workflows (real AppModule)', () => {
  let app: INestApplication;
  let bookings: Model<Booking>;
  let invoices: Model<Invoice>;
  let issues: Model<Issue>;
  let roomTypes: Model<RoomType>;
  let rooms: Model<Room>;
  let orders: Model<ServiceOrder>;
  let services: Model<Service>;
  let tasks: Model<Task>;
  let users: Model<User>;
  const originalUri = process.env.MONGODB_URI;
  const customer = new Types.ObjectId();
  const receptionist = new Types.ObjectId();
  const manager = new Types.ObjectId();
  const worker = new Types.ObjectId();
  const coworker = new Types.ObjectId();
  const operations = new Types.ObjectId();
  const outsider = new Types.ObjectId();
  const booking = new Types.ObjectId();
  const room = new Types.ObjectId();
  const roomType = new Types.ObjectId();
  const service = new Types.ObjectId();
  const actors = [
    [customer, 'CUSTOMER'],
    [receptionist, 'RECEPTIONIST'],
    [manager, 'MANAGER'],
    [worker, 'SERVICE_STAFF'],
    [coworker, 'SERVICE_STAFF'],
    [operations, 'OPERATIONS_STAFF'],
    [outsider, 'CUSTOMER'],
  ] as const;
  const orderIds: string[] = [];
  const issueIds: string[] = [];
  const auth = (id: Types.ObjectId) => ({
    'x-dev-user-id': String(id),
    'x-dev-role': actors.find(([actor]) => actor.equals(id))![1],
  });
  const http = () => request(app.getHttpServer());
  const get = (path: string, actor = customer) =>
    http().get(`/api/v1${path}`).set(auth(actor));
  const post = (path: string, body: object, actor = customer) =>
    http().post(`/api/v1${path}`).set(auth(actor)).send(body);
  const patch = (path: string, body: object, actor = receptionist) =>
    http().patch(`/api/v1${path}`).set(auth(actor)).send(body);
  const progress = (id: string, status: string, actor = worker) =>
    patch(
      `/tasks/${id}/progress`,
      {
        status,
        ...(status === 'COMPLETED' ? { workResult: 'Private QA result' } : {}),
      },
      actor,
    );
  const createOrder = async () => {
    const requestId = randomUUID();
    const body = {
      bookingId: String(booking),
      serviceId: String(service),
      quantity: 2,
      requestId,
    };
    const responses = await Promise.all(
      Array.from({ length: 4 }, () =>
        post('/service-orders', body).expect(201),
      ),
    );
    const id = responses[0].body.id as string;
    orderIds.push(id);
    expect(new Set(responses.map((response) => response.body.id)).size).toBe(1);
    expect(await orders.countDocuments({ customer, requestId })).toBe(1);
    expect(responses[0].body).toMatchObject({
      reviewStatus: 'PENDING_REVIEW',
      executionStatus: 'NOT_STARTED',
      amount: 100000,
    });
    expect(
      await tasks.countDocuments({ sourceId: new Types.ObjectId(id) }),
    ).toBe(0);
    return id;
  };
  const accept = (id: string) =>
    patch(`/service-orders/${id}/review`, { decision: 'ACCEPT' });
  const assignOrder = async (id: string) => {
    const responses = await Promise.all(
      Array.from({ length: 4 }, () =>
        post(
          `/service-orders/${id}/assignment`,
          { assigneeId: String(worker) },
          receptionist,
        ),
      ),
    );
    expect(
      responses.every((response) => [201, 409].includes(response.status)),
    ).toBe(true);
    expect(responses.some((response) => response.status === 201)).toBe(true);
    expect(
      await tasks.countDocuments({ sourceId: new Types.ObjectId(id) }),
    ).toBe(1);
    const task = await tasks
      .findOne({ sourceId: new Types.ObjectId(id) })
      .orFail();
    expect(task).toMatchObject({
      sourceType: 'SERVICE_ORDER',
      taskType: 'SERVICE_ORDER_EXECUTION',
      status: 'ASSIGNED',
      assignedTo: worker,
    });
    return String(task._id);
  };
  const report = async () => {
    const response = await post('/issues', {
      title: `QA-${randomUUID()}`,
      category: 'Lighting',
      description: 'Lamp needs attention',
      bookingId: String(booking),
      roomId: String(room),
    }).expect(201);
    issueIds.push(response.body.id);
    return response.body.id as string;
  };
  const reviewIssue = (
    id: string,
    handlingCategory = 'SERVICE',
    needsStaffAction = true,
  ) =>
    patch(`/issues/${id}/review`, {
      handlingCategory,
      priority: 'NORMAL',
      needsStaffAction,
      notes: 'Private review',
    });
  const close = (id: string, actor = receptionist) =>
    post(`/issues/${id}/close`, { conclusion: 'Private closure' }, actor);
  const ledger = async (id: string) => {
    const invoice = await invoices.findOne({ booking }).orFail();
    const charges = invoice.charges.filter((charge) => charge.sourceId === id);
    expect(charges).toHaveLength(1);
    expect(charges[0]).toMatchObject({
      type: 'SERVICE',
      amount: 100000,
      approved: true,
      reason: `Service order ${id}`,
    });
    return invoice.toObject();
  };

  beforeAll(async () => {
    assertTestDatabase(originalUri);
    const uri = new URL(originalUri!);
    uri.pathname = `/hms_vu_${randomUUID().replaceAll('-', '')}_test`;
    process.env.MONGODB_URI = uri.toString();
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
    bookings = app.get(getModelToken(Booking.name));
    invoices = app.get(getModelToken(Invoice.name));
    issues = app.get(getModelToken(Issue.name));
    roomTypes = app.get(getModelToken(RoomType.name));
    rooms = app.get(getModelToken(Room.name));
    orders = app.get(getModelToken(ServiceOrder.name));
    services = app.get(getModelToken(Service.name));
    tasks = app.get(getModelToken(Task.name));
    users = app.get(getModelToken(User.name));
    await Promise.all([
      bookings.init(),
      invoices.init(),
      issues.init(),
      roomTypes.init(),
      rooms.init(),
      orders.init(),
      services.init(),
      tasks.init(),
      users.init(),
    ]);
    await users.create(
      actors.map(([_id, role]) => ({
        _id,
        role,
        email: `${_id}@vu-qa.test`,
        fullName: `QA ${role}`,
        isActive: true,
      })),
    );
    await roomTypes.create({
      _id: roomType,
      name: `QA-${roomType}`,
      adultCapacity: 2,
      childCapacity: 0,
      basePrice: 300000,
    });
    await rooms.create({
      _id: room,
      roomNumber: `QA-${room}`,
      floor: 1,
      roomType,
    });
    await bookings.create({
      _id: booking,
      code: `QA-${booking}`,
      customer,
      rooms: [room],
      guestName: 'Private guest',
      guestEmail: 'private@vu-qa.test',
      guestPhone: '0900000000',
      checkIn: new Date('2026-10-20T07:00:00Z'),
      checkOut: new Date('2026-10-22T07:00:00Z'),
      adultCount: 1,
      childCount: 0,
      status: BookingStatus.CheckedIn,
      roomTotal: 600000,
      depositAmount: 0,
    });
    await services.create({
      _id: service,
      name: `QA-${service}`,
      unit: 'kg',
      billable: true,
      price: 50000,
    });
  }, 60000);

  afterAll(async () => {
    try {
      if (!app) return;
      if (tasks)
        await tasks.deleteMany({
          sourceId: {
            $in: [...orderIds, ...issueIds].map((id) => new Types.ObjectId(id)),
          },
        });
      if (issues)
        await issues.deleteMany({
          reporter: { $in: [customer, worker] },
          booking,
        });
      if (orders) await orders.deleteMany({ customer, booking });
      if (invoices) await invoices.deleteMany({ booking });
      if (bookings) await bookings.deleteOne({ _id: booking });
      if (rooms) await rooms.deleteOne({ _id: room });
      if (roomTypes) await roomTypes.deleteOne({ _id: roomType });
      if (services) await services.deleteOne({ _id: service });
      if (users)
        await users.deleteMany({ _id: { $in: actors.map(([id]) => id) } });
    } finally {
      if (app) await app.close();
      if (originalUri === undefined) delete process.env.MONGODB_URI;
      else process.env.MONGODB_URI = originalUri;
    }
  });

  it('A: accepts and bills once, assigns, feeds dashboard reads, completes and exposes only own history', async () => {
    const id = await createOrder();
    const accepted = await Promise.all(
      Array.from({ length: 4 }, () => accept(id)),
    );
    expect(accepted.map((response) => response.status)).toEqual([
      200, 200, 200, 200,
    ]);
    await accept(id).expect(200);
    const invoice = await ledger(id);
    expect(invoice.roomTotal).toBe(600000);
    const taskId = await assignOrder(id);
    await get(`/tasks/${taskId}`, worker).expect(200);
    await get(`/tasks/${taskId}`, coworker).expect(404);
    await progress(taskId, 'IN_PROGRESS', coworker).expect(404);
    const dashboard = await get(
      '/tasks/me?status=ASSIGNED&page=1&limit=1',
      worker,
    ).expect(200);
    expect(dashboard.body).toMatchObject({ total: 1, items: [{ id: taskId }] });
    expect(
      (await get('/tasks/me?status=ASSIGNED', coworker).expect(200)).body.total,
    ).toBe(0);
    await progress(taskId, 'COMPLETED').expect(409);
    await progress(taskId, 'IN_PROGRESS').expect(200);
    expect(
      (await get('/tasks/me?status=IN_PROGRESS&limit=100', worker).expect(200))
        .body.items,
    ).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: taskId })]),
    );
    await progress(taskId, 'COMPLETED').expect(200);
    await progress(taskId, 'COMPLETED').expect(409);
    expect((await orders.findById(id).orFail()).executionStatus).toBe(
      'COMPLETED',
    );
    const own = await get(`/service-orders/history/${id}`, worker).expect(200);
    expect(own.body.task).toMatchObject({
      id: taskId,
      status: 'COMPLETED',
      workResult: 'Private QA result',
    });
    expect(
      (
        await get(
          `/service-orders/history/me?keyword=QA-${service}`,
          worker,
        ).expect(200)
      ).body.items,
    ).toEqual(expect.arrayContaining([expect.objectContaining({ id })]));
    await get(`/service-orders/history/${id}`, coworker).expect(404);
    expect(
      (await get('/service-orders/history/me', coworker).expect(200)).body
        .total,
    ).toBe(0);
    for (const path of [
      `/service-orders/${id}`,
      `/service-orders/requests/${id}`,
    ]) {
      const response = await get(
        path,
        path.includes('requests') ? receptionist : customer,
      ).expect(200);
      expect(JSON.stringify(response.body)).not.toContain('Private QA result');
      expect(JSON.stringify(response.body)).not.toContain('private@vu-qa.test');
    }
    expect(await ledger(id)).toEqual(invoice);
  });

  it.each([
    ['SERVICE', worker, receptionist],
    ['OPERATIONS', operations, manager],
  ] as const)(
    'B: customer issue through %s staff requires explicit authorized close after HTTP completion',
    async (category, actor, closer) => {
      const id = await report();
      await close(id).expect(409);
      await reviewIssue(id, category).expect(200);
      const assigned = await post(
        `/issues/${id}/assignment`,
        { assigneeId: String(actor) },
        receptionist,
      ).expect(201);
      const taskId = assigned.body.linkedTasks[0].id as string;
      await get(`/tasks/${taskId}`, actor).expect(200);
      await progress(taskId, 'COMPLETED', actor).expect(409);
      await close(id).expect(409);
      await progress(taskId, 'IN_PROGRESS', actor).expect(200);
      await close(id).expect(409);
      await progress(taskId, 'COMPLETED', actor).expect(200);
      expect((await issues.findById(id).orFail()).status).toBe('ASSIGNED');
      const task = await tasks.findById(taskId).lean();
      for (const wrong of [customer, worker, operations])
        await close(id, wrong).expect(403);
      await close(id, closer).expect(201);
      await close(id, closer).expect(409);
      expect(await tasks.findById(taskId).lean()).toEqual(task);
      const safe = await get(`/issues/${id}`).expect(200);
      expect(safe.body.status).toBe('CLOSED');
      for (const key of ['reviewNotes', 'closedBy', 'closureConclusion'])
        expect(safe.body).not.toHaveProperty(key);
      await get(`/issues/${id}`, outsider).expect(404);
    },
  );

  it.each([receptionist, manager])(
    'B: valid no-action conclusion closes without creating a Task (%s)',
    async (closer) => {
      const id = await report();
      const reviewed = await reviewIssue(id, 'SERVICE', false).expect(200);
      expect(reviewed.body.status).toBe('CONCLUDED');
      await post(
        `/issues/${id}/assignment`,
        { assigneeId: String(worker) },
        receptionist,
      ).expect(409);
      await close(id, closer).expect(201);
      expect(
        await tasks.countDocuments({ sourceId: new Types.ObjectId(id) }),
      ).toBe(0);
    },
  );

  it('C: UC34 persists service context and resolves a separate Issue without touching original in-progress work or ledger', async () => {
    const id = await createOrder();
    await accept(id).expect(200);
    const taskId = await assignOrder(id);
    await progress(taskId, 'IN_PROGRESS').expect(200);
    const originalTask = await tasks.findById(taskId).lean();
    const originalOrder = await orders.findById(id).lean();
    const invoice = await ledger(id);
    const path = `/issues/service-tasks/${taskId}`;
    const context = await get(`${path}/context`, worker).expect(200);
    expect(context.body).toMatchObject({
      taskId,
      taskStatus: 'IN_PROGRESS',
      serviceOrderId: id,
      booking: { id: String(booking) },
      service: { id: String(service) },
    });
    expect(JSON.stringify(context.body)).not.toContain('private@vu-qa.test');
    const body = {
      title: 'Delivery issue',
      category: 'Service',
      description: 'Separate resolution required',
      requestId: randomUUID(),
    };
    const results = await Promise.all(
      Array.from({ length: 4 }, () => post(path, body, worker).expect(201)),
    );
    const issueId = results[0].body.id as string;
    issueIds.push(issueId);
    expect(new Set(results.map((response) => response.body.id)).size).toBe(1);
    expect(await issues.findById(issueId).lean()).toMatchObject({
      reporter: worker,
      booking,
      service,
      serviceOrder: new Types.ObjectId(id),
      sourceTask: new Types.ObjectId(taskId),
      status: 'PENDING_REVIEW',
    });
    expect(
      await tasks.countDocuments({ sourceId: new Types.ObjectId(issueId) }),
    ).toBe(0);
    expect(await tasks.findById(taskId).lean()).toEqual(originalTask);
    expect(await orders.findById(id).lean()).toEqual(originalOrder);
    await get(`${path}/context`, coworker).expect(404);
    await post(path, body, coworker).expect(404);
    await post(path, { ...body, description: 'Changed intent' }, worker).expect(
      409,
    );
    await reviewIssue(issueId).expect(200);
    const assigned = await post(
      `/issues/${issueId}/assignment`,
      { assigneeId: String(coworker) },
      receptionist,
    ).expect(201);
    const resolutionId = assigned.body.linkedTasks[0].id as string;
    expect(resolutionId).not.toBe(taskId);
    await progress(resolutionId, 'IN_PROGRESS', coworker).expect(200);
    await progress(resolutionId, 'COMPLETED', coworker).expect(200);
    expect((await issues.findById(issueId).orFail()).status).toBe('ASSIGNED');
    await close(issueId, manager).expect(201);
    expect(await tasks.findById(taskId).lean()).toEqual(originalTask);
    expect(await orders.findById(id).lean()).toEqual(originalOrder);
    expect(await ledger(id)).toEqual(invoice);
  });

  it('recovers durable ACCEPTING after real pricing failure with one charge and no dependency mocks', async () => {
    const id = await createOrder();
    await rooms.updateOne({ _id: room }, { roomType: new Types.ObjectId() });
    try {
      await accept(id).expect(409);
      expect((await orders.findById(id).orFail()).reviewStatus).toBe(
        'ACCEPTING',
      );
    } finally {
      await rooms.updateOne({ _id: room }, { roomType });
    }
    await accept(id).expect(200);
    await accept(id).expect(200);
    await ledger(id);
    expect(
      await tasks.countDocuments({ sourceId: new Types.ObjectId(id) }),
    ).toBe(0);
  });

  it('enforces authentication, exact roles, ownership, malformed IDs, inactive catalog/booking and inactive execution', async () => {
    const id = await createOrder();
    await http().get(`/api/v1/service-orders/${id}`).expect(401);
    await http().post('/api/v1/issues').send({}).expect(401);
    await http().get('/api/v1/tasks/me').expect(401);
    await get(`/service-orders/${id}`, outsider).expect(404);
    await get('/service-orders/bad').expect(400);
    await get('/issues/bad').expect(404);
    await get('/tasks/bad', worker).expect(404);
    await accept(id).set(auth(manager)).expect(403);
    await post(
      '/service-orders',
      { bookingId: String(booking), serviceId: String(service), quantity: 1 },
      outsider,
    ).expect(404);
    await services.updateOne({ _id: service }, { isActive: false });
    try {
      await post('/service-orders', {
        bookingId: String(booking),
        serviceId: String(service),
        quantity: 1,
      }).expect(409);
    } finally {
      await services.updateOne({ _id: service }, { isActive: true });
    }
    await bookings.updateOne({ _id: booking }, { isActive: false });
    try {
      await post('/service-orders', {
        bookingId: String(booking),
        serviceId: String(service),
        quantity: 1,
      }).expect(409);
    } finally {
      await bookings.updateOne({ _id: booking }, { isActive: true });
    }
    await accept(id).expect(200);
    const taskId = await assignOrder(id);
    await users.updateOne({ _id: worker }, { isActive: false });
    try {
      await progress(taskId, 'IN_PROGRESS').expect(400);
      await get(`/issues/service-tasks/${taskId}/context`, worker).expect(403);
      expect((await tasks.findById(taskId).orFail()).status).toBe('ASSIGNED');
    } finally {
      await users.updateOne({ _id: worker }, { isActive: true });
    }
  });
});
