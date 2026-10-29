import { randomUUID } from 'node:crypto';
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
import { Service } from '../src/modules/services/schemas/service.schema.js';
import { ServiceOrder } from '../src/modules/service-orders/schemas/service-order.schema.js';
import { InvoicesService } from '../src/modules/invoices/invoices.service.js';
import { TasksService } from '../src/modules/tasks/tasks.service.js';
import { Task } from '../src/modules/tasks/schemas/task.schema.js';
import { User } from '../src/modules/users/schemas/user.schema.js';
import { Invoice } from '../src/modules/invoices/schemas/invoice.schema.js';
import { assertTestDatabase } from './test-database.js';

describe('UC22/23 customer service orders', () => {
  let app: INestApplication;
  let bookings: Model<Booking>;
  let services: Model<Service>;
  let orders: Model<ServiceOrder>;
  let bookingId: string;
  let serviceId: string;
  const customer = new Types.ObjectId();
  const other = new Types.ObjectId();
  const originalUri = process.env.MONGODB_URI;
  const auth = { 'x-dev-role': 'CUSTOMER', 'x-dev-user-id': String(customer) };
  const http = () => request(app.getHttpServer());
  const post = (body: object) =>
    http().post('/api/v1/service-orders').set(auth).send(body);
  const get = (path: string) =>
    http()
      .get('/api/v1/service-orders' + path)
      .set(auth);
  const body = () => ({ bookingId, serviceId, quantity: 2 });

  beforeAll(async () => {
    assertTestDatabase(originalUri);
    const uri = new URL(originalUri!);
    uri.pathname = `/hms_serviceorders_${randomUUID().replaceAll('-', '')}_test`;
    process.env.MONGODB_URI = uri.toString();
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    await app.init();
    bookings = app.get(getModelToken(Booking.name));
    services = app.get(getModelToken(Service.name));
    orders = app.get(getModelToken(ServiceOrder.name));
    await Promise.all([bookings.init(), services.init(), orders.init()]);
  }, 60000);

  beforeEach(async () => {
    await Promise.all([
      bookings.deleteMany({}),
      services.deleteMany({}),
      orders.deleteMany({}),
      app.get<Model<Task>>(getModelToken(Task.name)).deleteMany({}),
      app.get<Model<User>>(getModelToken(User.name)).deleteMany({}),
      app.get<Model<Invoice>>(getModelToken(Invoice.name)).deleteMany({}),
    ]);
    const booking = await bookings.create({
      code: randomUUID(),
      customer,
      guestName: 'Fixture',
      guestEmail: 'fixture@example.com',
      guestPhone: '0123456789',
      rooms: [new Types.ObjectId()],
      checkIn: new Date('2026-01-01'),
      checkOut: new Date('2026-01-10'),
      adultCount: 1,
      status: BookingStatus.CheckedIn,
      roomTotal: 0,
      depositAmount: 0,
    });
    bookingId = String(booking._id);
    const service = await services.create({
      name: 'Laundry.*',
      unit: 'kg',
      billable: true,
      price: 50000,
    });
    serviceId = String(service._id);
  });

  const staff = {
    'x-dev-role': 'RECEPTIONIST',
    'x-dev-user-id': String(new Types.ObjectId()),
  };
  const review = (id: string, decision = 'ACCEPT', reason?: string) =>
    http()
      .patch(`/api/v1/service-orders/${id}/review`)
      .set(staff)
      .send({ decision, ...(reason === undefined ? {} : { reason }) });
  const detail = (id: string) =>
    http().get(`/api/v1/service-orders/requests/${id}`).set(staff);
  const prepareBilling = async () => {
    const booking = await bookings.findById(bookingId).orFail();
    await bookings.updateOne(
      { _id: bookingId },
      {
        rateSnapshot: booking.rooms.map((room) => ({
          room,
          ratePerNight: 100000,
        })),
      },
    );
  };

  const assignment = (id: string, assigneeId: string, extra = {}) =>
    http()
      .post(`/api/v1/service-orders/${id}/assignment`)
      .set(staff)
      .send({ assigneeId, ...extra });
  const worker = (id: string) => ({
    'x-dev-role': 'SERVICE_STAFF',
    'x-dev-user-id': id,
  });
  const history = (id: string, suffix = '/me') =>
    http()
      .get('/api/v1/service-orders/history' + suffix)
      .set(worker(id));
  const createWorker = async (role = 'SERVICE_STAFF', isActive = true) => {
    const user = await app.get<Model<User>>(getModelToken(User.name)).create({
      email: `${randomUUID()}@example.com`,
      fullName: 'Worker',
      role,
      isActive,
    });
    return String(user._id);
  };

  it('R2 concurrently abandons only closed unbilled technical acceptance with immutable audit and intent', async () => {
    const id = (await post(body())).body.id;
    const reviewedAt = new Date('2026-01-02');
    const reviewedBy = new Types.ObjectId();
    await orders.updateOne(
      { _id: id },
      {
        $set: {
          reviewStatus: 'ACCEPTING',
          reviewDecision: 'ACCEPT',
          reviewReason: 'Original acceptance',
          reviewedBy,
          reviewedAt,
        },
      },
    );
    const payload = {
      decision: 'REJECT',
      reason: 'Unbilled acceptance abandoned',
      recoveryReason: 'Legacy closed stay reconciliation',
    };
    const recover = () =>
      http()
        .patch(`/api/v1/service-orders/${id}/review`)
        .set(staff)
        .send(payload);
    await recover().expect(409);
    await bookings.updateOne(
      { _id: bookingId },
      {
        $set: {
          status: BookingStatus.CheckedOut,
          checkedOutAt: new Date(),
          financialReconciliationOrderIds: [id],
          acceptanceReservations: [id],
        },
      },
    );
    for (const role of [
      'CUSTOMER',
      'MANAGER',
      'SERVICE_STAFF',
      'OPERATIONS_STAFF',
    ])
      await recover().set({ 'x-dev-role': role }).expect(403);
    await http()
      .patch(`/api/v1/service-orders/${id}/review`)
      .send(payload)
      .expect(401);
    const results = await Promise.all(Array.from({ length: 6 }, recover));
    expect(results.map((result) => result.status)).toEqual(Array(6).fill(200));
    const first = results[0].body;
    expect(first).toMatchObject({
      reviewStatus: 'REJECTED',
      executionStatus: 'NOT_STARTED',
      billingStatus: 'NOT_REQUIRED',
      review: {
        decision: 'ACCEPT',
        reason: payload.reason,
        reviewedBy: String(reviewedBy),
        reviewedAt: reviewedAt.toISOString(),
      },
      acceptanceRecovery: {
        decision: 'REJECT',
        reason: payload.recoveryReason,
        rejectionReason: payload.reason,
        actor: staff['x-dev-user-id'],
      },
    });
    const before = await orders
      .findById(id)
      .select(
        '+reviewDecision +reviewReason +reviewedBy +reviewedAt +acceptanceRecovery',
      )
      .orFail();
    await recover()
      .set({ 'x-dev-user-id': String(new Types.ObjectId()) })
      .expect(200);
    const after = await orders
      .findById(id)
      .select(
        '+reviewDecision +reviewReason +reviewedBy +reviewedAt +acceptanceRecovery',
      )
      .orFail();
    expect(JSON.stringify(after.acceptanceRecovery)).toBe(
      JSON.stringify(before.acceptanceRecovery),
    );
    expect(after.reviewDecision).toBe('ACCEPT');
    expect(after.reviewReason).toBe('Original acceptance');
    expect(after.reviewedAt).toEqual(reviewedAt);
    expect(String(after.reviewedBy)).toBe(String(reviewedBy));
    await review(id, 'ACCEPT', 'Original acceptance').expect(409);
    await recover()
      .send({ ...payload, recoveryReason: 'Different' })
      .expect(409);
    const booking = await bookings.findById(bookingId).orFail();
    expect(booking.financialReconciliationOrderIds).not.toContain(id);
    expect(booking.acceptanceReservations).not.toContain(id);
    expect(
      await app
        .get<Model<Invoice>>(getModelToken(Invoice.name))
        .countDocuments(),
    ).toBe(0);
    expect(
      await app.get<Model<Task>>(getModelToken(Task.name)).countDocuments(),
    ).toBe(0);
  });

  it('R2 refuses recovery for any persisted source charge, task, or ordinary pending rejection', async () => {
    await prepareBilling();
    const id = (await post(body())).body.id;
    const payload = {
      decision: 'REJECT',
      reason: 'Abandon',
      recoveryReason: 'Reconcile',
    };
    const recover = () =>
      http()
        .patch(`/api/v1/service-orders/${id}/review`)
        .set(staff)
        .send(payload);
    await recover().expect(409);
    await review(id).expect(200);
    await orders.updateOne(
      { _id: id },
      {
        $set: { reviewStatus: 'ACCEPTING' },
        $unset: { billedAt: '', billedInvoiceId: '' },
      },
    );
    await bookings.updateOne(
      { _id: bookingId },
      { status: BookingStatus.CheckedOut },
    );
    await recover().expect(409);
    const invoices = app.get<Model<Invoice>>(getModelToken(Invoice.name));
    await invoices.collection.updateMany(
      {},
      { $set: { isActive: false, 'charges.0.amount': 1 } },
    );
    await recover().expect(409);
    await invoices.deleteMany({});
    const tasks = app.get<Model<Task>>(getModelToken(Task.name));
    const taskId = new Types.ObjectId();
    await tasks.collection.insertOne({
      _id: taskId,
      sourceType: 'SERVICE_ORDER',
      sourceId: new Types.ObjectId(id),
    } as never);
    await recover().expect(409);
    expect(
      (await orders.findById(id).select('+acceptanceRecovery').orFail())
        .acceptanceRecovery,
    ).toBeUndefined();
  });

  it('UC26 gates exact roles, accepted state, persisted billing and eligible staff', async () => {
    const assignee = await createWorker();
    const id = (await post(body())).body.id;
    await assignment(id, assignee).expect(409);
    await prepareBilling();
    await review(id).expect(200);
    for (const role of [
      'CUSTOMER',
      'MANAGER',
      'SERVICE_STAFF',
      'OPERATIONS_STAFF',
    ]) {
      await assignment(id, assignee).set({ 'x-dev-role': role }).expect(403);
      await http()
        .get(`/api/v1/service-orders/${id}/assignees`)
        .set({ 'x-dev-role': role })
        .expect(403);
    }
    for (const invalid of [
      await createWorker('OPERATIONS_STAFF'),
      await createWorker('SERVICE_STAFF', false),
    ])
      await assignment(id, invalid).expect(400);
    const candidates = await http()
      .get(`/api/v1/service-orders/${id}/assignees`)
      .set(staff)
      .expect(200);
    expect(candidates.body.items).toEqual([
      { id: assignee, displayName: 'Worker', role: 'SERVICE_STAFF' },
    ]);
    const invoices = app.get<Model<Invoice>>(getModelToken(Invoice.name));
    await invoices.collection.updateOne(
      { booking: new Types.ObjectId(bookingId) },
      { $set: { charges: [] } },
    );
    await assignment(id, assignee).expect(409);
    expect(
      await app.get<Model<Task>>(getModelToken(Task.name)).countDocuments(),
    ).toBe(0);
    expect(
      (
        await invoices
          .findOne({ booking: new Types.ObjectId(bookingId) })
          .orFail()
      ).charges,
    ).toHaveLength(0);
    expect((await orders.findById(id).orFail()).executionStatus).toBe(
      'NOT_STARTED',
    );
  });

  it('R3 lets another receptionist retry persisted intent without overwriting its requester', async () => {
    await services.updateOne({ _id: serviceId }, { billable: false });
    const assignee = await createWorker();
    const id = (await post(body())).body.id;
    await review(id).expect(200);
    const create = vi
      .spyOn(app.get(TasksService), 'create')
      .mockRejectedValueOnce(new Error('unavailable'));
    await assignment(id, assignee).expect(503);
    create.mockRestore();
    const before = await orders
      .findById(id)
      .select('+assignmentRequestedBy +assignmentRequestedAt')
      .orFail();
    const recoveryActor = String(new Types.ObjectId());
    const results = await Promise.all(
      Array.from({ length: 6 }, () =>
        assignment(id, assignee).set({ 'x-dev-user-id': recoveryActor }),
      ),
    );
    expect(results.map((result) => result.status)).toEqual(Array(6).fill(201));
    const after = await orders
      .findById(id)
      .select(
        '+assignmentRequestedBy +assignmentRequestedAt +assignmentRecoveryAudit',
      )
      .orFail();
    expect(String(after.assignmentRequestedBy)).toBe(
      String(before.assignmentRequestedBy),
    );
    expect(after.assignmentRequestedAt).toEqual(before.assignmentRequestedAt);
    expect(after.assignmentRecoveryAudit).toHaveLength(1);
    expect(String(after.assignmentRecoveryAudit![0].actor)).toBe(recoveryActor);
    expect(after.assignmentRecoveryAudit![0].at).toBeInstanceOf(Date);
    expect(
      await app.get<Model<Task>>(getModelToken(Task.name)).countDocuments(),
    ).toBe(1);
  });

  it('R3 audits inactive-assignee replacement only before canonical or source work exists', async () => {
    await services.updateOne({ _id: serviceId }, { billable: false });
    const assignee = await createWorker();
    const replacement = await createWorker();
    const id = (await post(body())).body.id;
    await review(id).expect(200);
    const create = vi
      .spyOn(app.get(TasksService), 'create')
      .mockRejectedValueOnce(new Error('unavailable'));
    await assignment(id, assignee).expect(503);
    create.mockRestore();
    await assignment(id, replacement, {
      recoveryReason: 'Staff unavailable',
    }).expect(409);
    await app
      .get<Model<User>>(getModelToken(User.name))
      .updateOne({ _id: assignee }, { isActive: false });
    expect(
      (
        await http()
          .get(`/api/v1/service-orders/${id}/assignees`)
          .set(staff)
          .expect(200)
      ).body.recoveryAllowed,
    ).toBe(true);
    await assignment(id, replacement).expect(409);
    for (const recoveryReason of ['', '   ', null])
      await assignment(id, replacement, { recoveryReason }).expect(400);
    const recoveryActor = String(new Types.ObjectId());
    await assignment(id, replacement, {
      recoveryReason: 'Staff deactivated before creation',
    })
      .set({ 'x-dev-user-id': recoveryActor })
      .expect(201);
    const row = await orders
      .findById(id)
      .select('+assignmentRequestedBy +assignmentRecoveryAudit')
      .orFail();
    expect(String(row.assignmentRequestedBy)).toBe(staff['x-dev-user-id']);
    expect(row.assignmentRecoveryAudit).toHaveLength(1);
    expect(row.assignmentRecoveryAudit![0]).toMatchObject({
      reason: 'Staff deactivated before creation',
    });
    expect(String(row.assignmentRecoveryAudit![0].previousAssignee)).toBe(
      assignee,
    );
    expect(String(row.assignmentRecoveryAudit![0].assignee)).toBe(replacement);
    expect(String(row.assignmentRecoveryAudit![0].actor)).toBe(recoveryActor);
    const tasks = app.get<Model<Task>>(getModelToken(Task.name));
    expect(await tasks.countDocuments()).toBe(1);
    expect(String((await tasks.findOne().orFail()).assignedTo)).toBe(
      replacement,
    );
    const task = await tasks.findOne().orFail();
    for (const status of ['ASSIGNED', 'IN_PROGRESS', 'COMPLETED']) {
      if (status !== 'ASSIGNED')
        await http()
          .patch(`/api/v1/tasks/${task._id}/progress`)
          .set(worker(replacement))
          .send({
            status,
            ...(status === 'COMPLETED' ? { workResult: 'Done' } : {}),
          })
          .expect(200);
      const replay = await assignment(id, replacement, {
        recoveryReason: 'Staff deactivated before creation',
      })
        .set({ 'x-dev-user-id': String(new Types.ObjectId()) })
        .expect(201);
      expect(replay.body.task.id).toBe(String(task._id));
      expect(replay.body.executionStatus).toBe(status);
      await assignment(id, replacement, {
        recoveryReason: 'Different reason',
      }).expect(409);
      await assignment(id, replacement, {
        recoveryReason: 'Staff deactivated before creation',
        dueAt: '2026-12-01T00:00:00.000Z',
      }).expect(409);
      await assignment(id, assignee, {
        recoveryReason: 'Staff deactivated before creation',
      }).expect(409);
    }
    expect(
      (await orders.findById(id).select('+assignmentRecoveryAudit').orFail())
        .assignmentRecoveryAudit,
    ).toHaveLength(1);
    expect(await tasks.countDocuments()).toBe(1);
  });

  it('R3 fences recovery behind an in-flight old-owner task creation', async () => {
    await services.updateOne({ _id: serviceId }, { billable: false });
    const assignee = await createWorker();
    const replacement = await createWorker();
    const id = (await post(body())).body.id;
    await review(id).expect(200);
    const tasksService = app.get(TasksService);
    const original = tasksService.create.bind(tasksService);
    let entered!: () => void;
    let release!: () => void;
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const blocked = new Promise<void>((resolve) => {
      release = resolve;
    });
    const spy = vi
      .spyOn(tasksService, 'create')
      .mockImplementation(
        async (...args: Parameters<typeof tasksService.create>) => {
          const task = await original(...args);
          entered();
          await blocked;
          return task;
        },
      );
    const assigning = assignment(id, assignee).then((result) => result);
    await started;
    await app
      .get<Model<User>>(getModelToken(User.name))
      .updateOne({ _id: assignee }, { isActive: false });
    const recovery = assignment(id, replacement, {
      recoveryReason: 'Inactive during creation',
    }).then((result) => result);
    release();
    try {
      expect((await assigning).status).toBe(201);
      expect((await recovery).status).toBe(409);
    } finally {
      release();
      spy.mockRestore();
    }
    const tasks = app.get<Model<Task>>(getModelToken(Task.name));
    expect(await tasks.countDocuments()).toBe(1);
    expect(String((await tasks.findOne().orFail()).assignedTo)).toBe(assignee);
  });

  it.each(['canonical', 'source'])(
    'R3 refuses recovery owner changes with existing %s work while ASSIGNING',
    async (identity) => {
      await services.updateOne({ _id: serviceId }, { billable: false });
      const assignee = await createWorker();
      const replacement = await createWorker();
      const id = (await post(body())).body.id;
      await review(id).expect(200);
      const original = orders.findOneAndUpdate.bind(orders);
      const spy = vi
        .spyOn(orders, 'findOneAndUpdate')
        .mockImplementation(
          (...args: Parameters<typeof orders.findOneAndUpdate>) => {
            if (
              (args[0] as { executionStatus?: string }).executionStatus ===
              'ASSIGNING'
            )
              throw new Error('link unavailable');
            return original(...args);
          },
        );
      await assignment(id, assignee).expect(503);
      spy.mockRestore();
      await app
        .get<Model<User>>(getModelToken(User.name))
        .updateOne({ _id: assignee }, { isActive: false });
      if (identity === 'source')
        await orders.updateOne(
          { _id: id },
          { assignmentTaskId: new Types.ObjectId() },
        );
      await assignment(id, replacement, {
        recoveryReason: 'Staff inactive',
      }).expect(409);
      const existing = await app
        .get<Model<Task>>(getModelToken(Task.name))
        .findOne()
        .orFail();
      if (identity === 'source')
        await orders.updateOne({ _id: id }, { assignmentTaskId: existing._id });
      await assignment(id, assignee)
        .set({ 'x-dev-user-id': String(new Types.ObjectId()) })
        .expect(201);
      const tasks = app.get<Model<Task>>(getModelToken(Task.name));
      expect(await tasks.countDocuments()).toBe(1);
      expect(String((await tasks.findOne().orFail()).assignedTo)).toBe(
        assignee,
      );
    },
  );

  it('UC26 races create one canonical task; UC38 progress feeds private UC27 history', async () => {
    await prepareBilling();
    const assignee = await createWorker();
    const stranger = await createWorker();
    const id = (await post(body())).body.id;
    await review(id).expect(200);
    const dueAt = '2026-12-01T10:00:00.000Z';
    const results = await Promise.all(
      Array.from({ length: 6 }, () => assignment(id, assignee, { dueAt })),
    );
    expect(results.every((r) => r.status === 201)).toBe(true);
    const tasks = app.get<Model<Task>>(getModelToken(Task.name));
    expect(await tasks.countDocuments()).toBe(1);
    const task = await tasks.findOne().orFail();
    expect(task).toMatchObject({
      taskType: 'SERVICE_ORDER_EXECUTION',
      sourceType: 'SERVICE_ORDER',
      status: 'ASSIGNED',
    });
    expect(String(task.sourceId)).toBe(id);
    const replay = await assignment(id, assignee, { dueAt }).expect(201);
    expect(replay.body.task.id).toBe(String(task._id));
    expect(results.every((r) => r.body.task.id === String(task._id))).toBe(
      true,
    );
    expect(await tasks.countDocuments()).toBe(1);
    await assignment(id, stranger, { dueAt }).expect(409);
    await assignment(id, assignee, {
      dueAt: '2026-12-02T10:00:00.000Z',
    }).expect(409);
    expect((await history(assignee).expect(200)).body.total).toBe(0);
    const progress = (status: string, workResult?: string) =>
      http()
        .patch(`/api/v1/tasks/${task._id}/progress`)
        .set(worker(assignee))
        .send({ status, ...(workResult ? { workResult } : {}) });
    await progress('IN_PROGRESS').expect(200);
    expect((await get('/' + id).expect(200)).body.executionStatus).toBe(
      'IN_PROGRESS',
    );
    await progress('COMPLETED', 'Laundry delivered').expect(200);
    const completedReplay = await assignment(id, assignee, { dueAt }).expect(
      201,
    );
    expect(completedReplay.body).toMatchObject({
      executionStatus: 'COMPLETED',
      task: { id: String(task._id), status: 'COMPLETED' },
    });
    expect(await tasks.countDocuments()).toBe(1);
    expect((await orders.findById(id).orFail()).executionStatus).toBe(
      'COMPLETED',
    );
    const own = await history(assignee)
      .query({ keyword: 'Laundry.*', from: '2020-01-01', to: '2030-01-01' })
      .expect(200);
    expect(own.body).toMatchObject({
      total: 1,
      page: 1,
      limit: 20,
      items: [
        {
          id,
          executionStatus: 'COMPLETED',
          task: {
            id: String(task._id),
            status: 'COMPLETED',
            workResult: 'Laundry delivered',
            dueAt,
          },
        },
      ],
    });
    await history(assignee, '/' + id).expect(200);
    expect((await history(stranger).expect(200)).body.total).toBe(0);
    await history(stranger, '/' + id).expect(404);
    for (const role of [
      'CUSTOMER',
      'RECEPTIONIST',
      'MANAGER',
      'OPERATIONS_STAFF',
    ])
      await history(assignee).set({ 'x-dev-role': role }).expect(403);
    expect(
      JSON.stringify((await get('/' + id).expect(200)).body),
    ).not.toContain('Laundry delivered');
    expect(JSON.stringify((await detail(id).expect(200)).body)).not.toContain(
      'Laundry delivered',
    );
    await history(assignee)
      .query({ from: '2030-01-01', to: '2020-01-01' })
      .expect(400);
    await history(assignee).query({ limit: 101 }).expect(400);
    await orders.updateOne(
      { _id: id },
      { $set: { linkedTask: new Types.ObjectId() } },
    );
    expect((await history(assignee).expect(200)).body.total).toBe(0);
  });

  it('blocks pending execution until assignment retry links the same Task and repairs failed projections on reads', async () => {
    await services.updateOne({ _id: serviceId }, { billable: false });
    const assignee = await createWorker();
    const id = (await post(body())).body.id;
    await review(id).expect(200);
    const original = orders.findOneAndUpdate.bind(orders);
    const spy = vi
      .spyOn(orders, 'findOneAndUpdate')
      .mockImplementation(
        (...args: Parameters<typeof orders.findOneAndUpdate>) => {
          if (
            (args[0] as { executionStatus?: string }).executionStatus ===
            'ASSIGNING'
          )
            throw new Error('link unavailable');
          return original(...args);
        },
      );
    await assignment(id, assignee).expect(503);
    spy.mockRestore();
    const task = await app
      .get<Model<Task>>(getModelToken(Task.name))
      .findOne()
      .orFail();
    const progress = (status: string, workResult?: string) =>
      http()
        .patch(`/api/v1/tasks/${task._id}/progress`)
        .set(worker(assignee))
        .send({ status, ...(workResult ? { workResult } : {}) });
    await progress('IN_PROGRESS').expect(409);
    await progress('COMPLETED', 'Done').expect(409);
    const unchanged = await app
      .get<Model<Task>>(getModelToken(Task.name))
      .findById(task._id)
      .orFail();
    expect(unchanged.status).toBe('ASSIGNED');
    expect(unchanged.completedAt).toBeUndefined();
    expect(unchanged.workResult).toBeUndefined();
    const pending = await orders.findById(id).orFail();
    expect(pending.executionStatus).toBe('ASSIGNING');
    expect(pending.linkedTask).toBeUndefined();
    expect((await history(assignee).expect(200)).body.total).toBe(0);
    await assignment(id, await createWorker()).expect(409);
    const recovered = await assignment(id, assignee).expect(201);
    expect(recovered.body.executionStatus).toBe('ASSIGNED');
    expect(String((await orders.findById(id).orFail()).linkedTask)).toBe(
      String(task._id),
    );
    await progress('IN_PROGRESS').expect(200);
    expect((await orders.findById(id).orFail()).executionStatus).toBe(
      'IN_PROGRESS',
    );
    await progress('COMPLETED', 'Done').expect(200);
    expect((await orders.findById(id).orFail()).executionStatus).toBe(
      'COMPLETED',
    );
    expect((await history(assignee).expect(200)).body.total).toBe(1);
    expect(
      await app.get<Model<Task>>(getModelToken(Task.name)).countDocuments(),
    ).toBe(1);
    await orders.updateOne(
      { _id: id },
      { $set: { executionStatus: 'ASSIGNED' } },
    );
    expect(
      (await get('/me').query({ executionStatus: 'COMPLETED' }).expect(200))
        .body.total,
    ).toBe(1);
    expect((await orders.findById(id).orFail()).executionStatus).toBe(
      'COMPLETED',
    );
  });

  it('recovers Task-create failures with stable intent and returns committed progress even if projection fails', async () => {
    await services.updateOne({ _id: serviceId }, { billable: false });
    const assignee = await createWorker();
    const id = (await post(body())).body.id;
    await review(id).expect(200);
    const core = app.get(TasksService);
    const createFailure = vi
      .spyOn(core, 'create')
      .mockRejectedValueOnce(new Error('create unavailable'));
    await assignment(id, assignee).expect(503);
    createFailure.mockRestore();
    const pending = await orders
      .findById(id)
      .select('+assignmentRequestedAt +assignmentTitle')
      .orFail();
    expect(pending.executionStatus).toBe('ASSIGNING');
    await assignment(id, assignee, { dueAt: '2026-12-02T10:00:00Z' }).expect(
      409,
    );
    await assignment(id, assignee).expect(201);
    const task = await app
      .get<Model<Task>>(getModelToken(Task.name))
      .findOne()
      .orFail();
    expect(String(task._id)).toBe(String(pending.assignmentTaskId));
    expect(task.assignedAt).toEqual(pending.assignmentRequestedAt);
    const progress = (status: string, workResult?: string) =>
      http()
        .patch(`/api/v1/tasks/${task._id}/progress`)
        .set(worker(assignee))
        .send({ status, ...(workResult ? { workResult } : {}) });
    await progress('IN_PROGRESS').expect(200);
    const projectionFailure = vi
      .spyOn(core, 'repairServiceOrderExecution')
      .mockRejectedValueOnce(new Error('projection unavailable'));
    await progress('COMPLETED', 'Delivered safely').expect(200);
    projectionFailure.mockRestore();
    expect((await orders.findById(id).orFail()).executionStatus).toBe(
      'IN_PROGRESS',
    );
    await progress('COMPLETED', 'Delivered safely').expect(409);
    expect((await detail(id).expect(200)).body).toMatchObject({
      executionStatus: 'COMPLETED',
      task: { status: 'COMPLETED' },
    });
    expect((await history(assignee).expect(200)).body.total).toBe(1);
    const dashboard = await http()
      .get('/api/v1/tasks/me')
      .set(worker(assignee))
      .query({ status: 'COMPLETED' })
      .expect(200);
    expect(dashboard.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: String(task._id), status: 'COMPLETED' }),
      ]),
    );
  });

  it.each([undefined, '2026-12-02T12:30:00+07:00'])(
    'projects only persisted pending assignment intent and recovers after reload (dueAt=%s)',
    async (dueAt) => {
      await services.updateOne({ _id: serviceId }, { billable: false });
      const assigneeId = await createWorker();
      const id = (await post(body())).body.id;
      expect((await detail(id).expect(200)).body).not.toHaveProperty(
        'assignmentIntent',
      );
      await review(id).expect(200);
      expect((await detail(id).expect(200)).body).not.toHaveProperty(
        'assignmentIntent',
      );
      const core = app.get(TasksService);
      const failure = vi
        .spyOn(core, 'create')
        .mockRejectedValueOnce(new Error('create unavailable'));
      await assignment(id, assigneeId, dueAt ? { dueAt } : {}).expect(503);
      failure.mockRestore();
      const expected = {
        assigneeId,
        ...(dueAt ? { dueAt: new Date(dueAt).toISOString() } : {}),
      };
      const reloaded = (await detail(id).expect(200)).body;
      expect(reloaded.executionStatus).toBe('ASSIGNING');
      expect(reloaded.assignmentIntent).toEqual(expected);
      const list = await http()
        .get('/api/v1/service-orders/requests')
        .set(staff)
        .query({ reviewStatus: 'ACCEPTED', executionStatus: 'ASSIGNING' })
        .expect(200);
      expect(list.body.items[0].assignmentIntent).toEqual(expected);
      const customerDetail = (await get('/' + id).expect(200)).body;
      const customerList = (await get('/me').expect(200)).body.items[0];
      for (const row of [customerDetail, customerList]) {
        expect(row).not.toHaveProperty('assignmentIntent');
        expect(row).not.toHaveProperty('assignmentAssignee');
        expect(row).not.toHaveProperty('assignmentDueAt');
      }
      const recovered = await http()
        .post(`/api/v1/service-orders/${id}/assignment`)
        .set(staff)
        .send(reloaded.assignmentIntent)
        .expect(201);
      expect(recovered.body.executionStatus).toBe('ASSIGNED');
      expect(recovered.body).not.toHaveProperty('assignmentIntent');
      expect((await detail(id).expect(200)).body).not.toHaveProperty(
        'assignmentIntent',
      );
      expect(
        await app.get<Model<Task>>(getModelToken(Task.name)).countDocuments(),
      ).toBe(1);
      const task = await app
        .get<Model<Task>>(getModelToken(Task.name))
        .findOne()
        .orFail();
      expect(String(task.assignedTo)).toBe(assigneeId);
      expect(task.dueAt?.toISOString()).toBe(expected.dueAt);
    },
  );

  it('requires an existing billed invoice and refuses mismatched ledger snapshots without recreating it', async () => {
    await prepareBilling();
    const assignee = await createWorker();
    const id = (await post(body())).body.id;
    await review(id).expect(200);
    const invoices = app.get<Model<Invoice>>(getModelToken(Invoice.name));
    const invoice = await invoices
      .findOne({ booking: new Types.ObjectId(bookingId) })
      .orFail();
    for (const patch of [
      { 'charges.0.amount': 1 },
      { 'charges.0.reason': 'Other' },
      { 'charges.0.type': 'OTHER' },
      { 'charges.0.approved': false },
      { booking: new Types.ObjectId() },
    ]) {
      await invoices.collection.updateOne(
        { _id: invoice._id },
        { $set: patch },
      );
      await assignment(id, assignee).expect(409);
      await invoices.collection.replaceOne(
        { _id: invoice._id },
        invoice.toObject(),
      );
    }
    await invoices.deleteMany({});
    await assignment(id, assignee).expect(409);
    expect(await invoices.countDocuments()).toBe(0);
    expect(
      await app.get<Model<Task>>(getModelToken(Task.name)).countDocuments(),
    ).toBe(0);
  });

  it('protects staff routes with exact role and validates review bodies', async () => {
    const id = (await post(body())).body.id;
    for (const role of [
      'CUSTOMER',
      'MANAGER',
      'SERVICE_STAFF',
      'OPERATIONS_STAFF',
    ]) {
      await http()
        .get('/api/v1/service-orders/requests')
        .set({ 'x-dev-role': role })
        .expect(403);
      await detail(id).set({ 'x-dev-role': role }).expect(403);
      await review(id).set({ 'x-dev-role': role }).expect(403);
    }
    await http().get('/api/v1/service-orders/requests').expect(401);
    await http().get(`/api/v1/service-orders/requests/${id}`).expect(401);
    await http()
      .patch(`/api/v1/service-orders/${id}/review`)
      .send({ decision: 'ACCEPT' })
      .expect(401);
    for (const payload of [
      { decision: 'REJECT' },
      { decision: 'REJECT', reason: '  ' },
      { decision: 'ACCEPT', reason: null },
      { decision: 'OTHER' },
      { decision: 'ACCEPT', amount: 1 },
      { decision: 'ACCEPT', reason: 'x'.repeat(2001) },
    ])
      await http()
        .patch(`/api/v1/service-orders/${id}/review`)
        .set(staff)
        .send(payload)
        .expect(400);
    await detail('bad').expect(400);
    await detail(String(new Types.ObjectId())).expect(404);
  });

  it('lists pending latest first and provides only authorized operational metadata', async () => {
    const a = (await post(body())).body.id;
    const b = (await post(body())).body.id;
    await review(a, 'REJECT', '  unavailable  ').expect(200);
    const list = await http()
      .get('/api/v1/service-orders/requests')
      .set(staff)
      .query({ keyword: 'Laundry.*', limit: 1 })
      .expect(200);
    expect(list.body).toMatchObject({
      total: 1,
      page: 1,
      limit: 1,
      items: [{ id: b, billingStatus: 'NOT_REQUIRED' }],
    });
    const rejected = (await detail(a).expect(200)).body;
    expect(rejected).toMatchObject({
      reviewStatus: 'REJECTED',
      review: { decision: 'REJECT', reason: 'unavailable' },
      booking: { code: expect.any(String) },
    });
    expect(JSON.stringify(rejected)).not.toMatch(
      /guestEmail|guestPhone|requestFingerprint|firebaseUid/,
    );
    const customerDetail = (await get('/' + a).expect(200)).body;
    expect(customerDetail.review).toBeUndefined();
    expect(customerDetail.reviewedBy).toBeUndefined();
    expect(await orders.db.collection('tasks').countDocuments()).toBe(0);
    expect(
      await app
        .get<Model<Invoice>>(getModelToken(Invoice.name))
        .countDocuments({ booking: bookingId }),
    ).toBe(0);
  });

  it('accepts exactly once under races using original price and recalculated unpaid invoice', async () => {
    await prepareBilling();
    const id = (await post(body())).body.id;
    await services.updateOne(
      { _id: serviceId },
      { price: 999999, billable: false, isActive: false },
    );
    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        review(id, 'ACCEPT', ' okay ').expect(200),
      ),
    );
    expect(
      new Set(results.map((result) => result.body.review.reviewedAt)).size,
    ).toBe(1);
    expect(results[0].body).toMatchObject({
      amount: 100000,
      billingStatus: 'BILLED',
      bookingId,
    });
    const invoice = await app
      .get(InvoicesService)
      .getOrCreateForBooking(bookingId);
    expect(invoice.charges).toHaveLength(1);
    expect(invoice.charges[0]).toMatchObject({
      type: 'SERVICE',
      amount: 100000,
      sourceId: id,
      reason: `Service order ${id}`,
    });
    expect(invoice.serviceTotal).toBe(100000);
    expect(invoice.balanceDue).toBe(invoice.totalAmount);
    expect(results[0].body).toMatchObject({
      reviewStatus: 'ACCEPTED',
      billingStatus: 'BILLED',
      invoiceId: String(invoice._id),
    });
    await review(id, 'REJECT', 'no').expect(409);
    await review(id, 'ACCEPT', 'different').expect(409);
  });

  it('arbitrates competing accept/reject without billing rejected requests', async () => {
    await prepareBilling();
    const id = (await post(body())).body.id;
    const results = await Promise.all([review(id), review(id, 'REJECT', 'no')]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    const result = (await detail(id)).body;
    const invoice = await app
      .get<Model<Invoice>>(getModelToken(Invoice.name))
      .findOne({ booking: new Types.ObjectId(bookingId) });
    expect(invoice?.charges.length ?? 0).toBe(
      result.reviewStatus === 'ACCEPTED' ? 1 : 0,
    );
    expect(await orders.db.collection('tasks').countDocuments()).toBe(0);
  });

  it.each([false, true])(
    'skips charging effective zero-price orders (billable=%s)',
    async (billable) => {
      await services.updateOne({ _id: serviceId }, { billable, price: 0 });
      const id = (await post(body())).body.id;
      await services.updateOne(
        { _id: serviceId },
        { billable: true, price: 50000 },
      );
      const result = await review(id).expect(200);
      expect(result.body).toMatchObject({
        reviewStatus: 'ACCEPTED',
        billingStatus: 'NOT_REQUIRED',
        feeRequired: false,
      });
      expect(
        await app
          .get<Model<Invoice>>(getModelToken(Invoice.name))
          .countDocuments({ booking: bookingId }),
      ).toBe(0);
    },
  );

  it('recovers billing failures before and after persistence without changing first audit', async () => {
    await prepareBilling();
    const id = (await post(body())).body.id;
    const billing = app.get(InvoicesService);
    const original = billing.addCharge.bind(billing);
    const spy = vi
      .spyOn(billing, 'addCharge')
      .mockRejectedValueOnce(new Error('private failure'));
    const failed = await review(id, 'ACCEPT', ' okay ').expect(503);
    expect(JSON.stringify(failed.body)).not.toContain('private failure');
    const pending = (await detail(id)).body;
    expect(pending).toMatchObject({
      reviewStatus: 'ACCEPTING',
      billingStatus: 'PENDING',
    });
    expect((await get('/' + id)).body.reviewStatus).toBe('ACCEPTING');
    await review(id, 'REJECT', 'no').expect(409);
    await review(id, 'ACCEPT', 'different').expect(409);
    spy.mockImplementationOnce(async (input) => {
      await original(input);
      throw new Error('lost acknowledgement');
    });
    const result = await review(id, 'ACCEPT', 'okay').expect(200);
    expect(result.body.review).toEqual(pending.review);
    expect(
      (await billing.getOrCreateForBooking(bookingId)).charges,
    ).toHaveLength(1);
    spy.mockRestore();
  });

  it('recovers finalization failure and existing charge even after checkout', async () => {
    await prepareBilling();
    const id = (await post(body())).body.id;
    const original = orders.findOneAndUpdate.bind(orders);
    const spy = vi.spyOn(orders, 'findOneAndUpdate');
    spy.mockImplementationOnce(original).mockImplementationOnce(() => {
      throw new Error('write failure');
    });
    await review(id).expect(503);
    spy.mockRestore();
    const pending = (await detail(id)).body;
    expect(pending.reviewStatus).toBe('ACCEPTING');
    await bookings.updateOne(
      { _id: bookingId },
      { status: BookingStatus.CheckedOut },
    );
    const billingSpy = vi.spyOn(app.get(InvoicesService), 'addCharge');
    const recovered = await review(id).expect(200);
    expect(recovered.body.review).toEqual(pending.review);
    expect(recovered.body.billingStatus).toBe('BILLED');
    expect(billingSpy).not.toHaveBeenCalled();
    billingSpy.mockRestore();
  });

  it('does not bill closed stays or trust an invoice for another booking', async () => {
    await prepareBilling();
    const id = (await post(body())).body.id;
    await bookings.updateOne(
      { _id: bookingId },
      { status: BookingStatus.CheckedOut },
    );
    await review(id).expect(409);
    expect((await detail(id)).body.reviewStatus).toBe('PENDING_REVIEW');
    await bookings.updateOne(
      { _id: bookingId },
      { status: BookingStatus.CheckedIn },
    );
    const billing = app.get(InvoicesService);
    const invoice = await billing.getOrCreateForBooking(bookingId);
    invoice.booking = new Types.ObjectId();
    const spy = vi
      .spyOn(billing, 'getOrCreateForBooking')
      .mockResolvedValueOnce(invoice);
    await review(id).expect(409);
    spy.mockRestore();
    expect((await detail(id)).body.reviewStatus).toBe('ACCEPTING');
    expect(
      (await billing.getOrCreateForBooking(bookingId)).charges,
    ).toHaveLength(0);
    const result = await review(id)
      .set({ 'x-dev-user-id': String(new Types.ObjectId()) })
      .expect(200);
    expect(result.body.review.reviewedBy).toBe(staff['x-dev-user-id']);
  });

  it('fails closed for inconsistent snapshots and conflicting existing charges', async () => {
    await prepareBilling();
    const id = (await post(body())).body.id;
    await orders.collection.updateOne(
      { _id: new Types.ObjectId(id) },
      { $set: { amount: 1 } },
    );
    await review(id).expect(409);
    expect((await detail(id)).body.reviewStatus).toBe('PENDING_REVIEW');
    await orders.collection.updateOne(
      { _id: new Types.ObjectId(id) },
      { $set: { amount: 100000 } },
    );
    await app.get(InvoicesService).addCharge({
      bookingId,
      type: 'SERVICE' as never,
      amount: 1,
      sourceId: id,
      reason: `Service order ${id}`,
    });
    await review(id).expect(409);
    expect((await detail(id)).body.reviewStatus).toBe('ACCEPTING');
  });

  afterAll(async () => {
    if (orders) await orders.db.dropDatabase();
    await app?.close();
    if (originalUri === undefined) delete process.env.MONGODB_URI;
    else process.env.MONGODB_URI = originalUri;
  });

  it('requires authentication and Customer role on every route', async () => {
    for (const path of [
      '',
      '/me',
      '/order-contexts',
      '/catalog',
      '/' + new Types.ObjectId(),
    ]) {
      const method = path === '' ? 'post' : 'get';
      await http()
        [method]('/api/v1/service-orders' + path)
        .send(body())
        .expect(401);
      for (const role of [
        'MANAGER',
        'RECEPTIONIST',
        'SERVICE_STAFF',
        'OPERATIONS_STAFF',
      ])
        await http()
          [method]('/api/v1/service-orders' + path)
          .set({ 'x-dev-role': role })
          .send(body())
          .expect(403);
    }
  });

  it('snapshots safe fields, starts pending/not started, has no charge/task side effects', async () => {
    const result = await post({ ...body(), notes: '  folded  ' }).expect(201);
    expect(result.body).toMatchObject({
      bookingId,
      serviceId,
      quantity: 2,
      unitPriceVND: 50000,
      amount: 100000,
      service: { name: 'Laundry.*', unit: 'kg' },
      notes: 'folded',
      reviewStatus: 'PENDING_REVIEW',
      executionStatus: 'NOT_STARTED',
    });
    expect(Object.keys(result.body).sort()).toEqual(
      [
        'id',
        'bookingId',
        'serviceId',
        'service',
        'quantity',
        'unitPriceVND',
        'amount',
        'requestedTime',
        'reviewStatus',
        'executionStatus',
        'notes',
        'createdAt',
      ].sort(),
    );
    await services.updateOne(
      { _id: serviceId },
      { price: 90000, name: 'Changed', unit: 'bag', isActive: false },
    );
    const detail = await get('/' + result.body.id).expect(200);
    expect(detail.body).toEqual(result.body);
    expect(await orders.db.collection('tasks').countDocuments()).toBe(0);
    expect(await orders.db.collection('invoices').countDocuments()).toBe(0);
    expect(orders.collection.collectionName).toBe('serviceorders');
  });

  it('rejects invalid quantities, IDs, dates, nulls and all client-controlled extras', async () => {
    for (const quantity of [0, -1, 1.5, '2', Number.MAX_SAFE_INTEGER + 1, null])
      await post({ ...body(), quantity }).expect(400);
    for (const extra of [
      'price',
      'unitPriceVND',
      'amount',
      'customer',
      'reviewStatus',
      'executionStatus',
      'title',
      'serviceName',
      'unit',
    ])
      await post({ ...body(), [extra]: 'forbidden' }).expect(400);
    for (const invalid of [
      { bookingId: 'bad' },
      { serviceId: 'bad' },
      { requestedTime: 'invalid' },
      { requestedTime: '2026-02-30T12:00:00Z' },
      { requestedTime: null },
      { notes: null },
      { requestId: 'bad' },
    ])
      await post({ ...body(), ...invalid }).expect(400);
    await get('/bad').expect(400);
  });

  it('enforces ownership, active checked-in booking, missing and inactive service', async () => {
    await bookings.updateOne({ _id: bookingId }, { customer: other });
    await post(body()).expect(404);
    await bookings.updateOne({ _id: bookingId }, { customer, isActive: false });
    await post(body()).expect(409);
    await bookings.updateOne(
      { _id: bookingId },
      { isActive: true, status: BookingStatus.CheckedOut },
    );
    await post(body()).expect(409);
    await bookings.updateOne(
      { _id: bookingId },
      { status: BookingStatus.CheckedIn },
    );
    await post({ ...body(), serviceId: String(new Types.ObjectId()) }).expect(
      404,
    );
    await services.updateOne({ _id: serviceId }, { isActive: false });
    await post(body()).expect(409);
  });

  it('supports nonbillable, zero-price and safe quantities above 1000; rejects monetary overflow', async () => {
    await services.updateOne(
      { _id: serviceId },
      { billable: false, price: null },
    );
    const free = await post({
      ...body(),
      quantity: Number.MAX_SAFE_INTEGER,
    }).expect(201);
    expect(free.body.amount).toBe(0);
    await services.updateOne({ _id: serviceId }, { billable: true, price: 0 });
    expect(
      (await post({ ...body(), quantity: 1001 }).expect(201)).body.amount,
    ).toBe(0);
    await services.updateOne(
      { _id: serviceId },
      { price: Number.MAX_SAFE_INTEGER },
    );
    await post(body()).expect(400);
  });

  it('accepts the H4 default empty service unit without inventing a required unit', async () => {
    await services.updateOne({ _id: serviceId }, { unit: '' });
    const result = await post(body()).expect(201);
    expect(result.body.service.unit).toBe('');
  });

  it('allows repeated orders without keys and guarantees real unique-index concurrent idempotency', async () => {
    const a = await post(body()).expect(201);
    const b = await post(body()).expect(201);
    expect(a.body.id).not.toBe(b.body.id);
    const requestId = randomUUID();
    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        post({ ...body(), requestId }).expect(201),
      ),
    );
    expect(new Set(results.map((row) => row.body.id)).size).toBe(1);
    expect(await orders.countDocuments()).toBe(3);
    const indexes = await orders.collection.indexes();
    expect(indexes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: { customer: 1, requestId: 1 },
          unique: true,
          partialFilterExpression: { requestId: { $exists: true } },
        }),
      ]),
    );
    await services.updateOne(
      { _id: serviceId },
      { price: 99999, isActive: false },
    );
    expect((await post({ ...body(), requestId }).expect(201)).body).toEqual(
      results[0].body,
    );
    await post({ ...body(), quantity: 3, requestId }).expect(409);
    await bookings.updateOne({ _id: bookingId }, { customer: other });
    await post({ ...body(), requestId }).expect(404);
  });

  it('normalizes explicit time/notes and keeps omitted requestedTime stable on retry', async () => {
    const requestId = randomUUID();
    const a = await post({
      ...body(),
      requestId,
      notes: ' hi ',
      requestedTime: '2026-01-03T12:00:00+07:00',
    }).expect(201);
    const b = await post({
      ...body(),
      requestId,
      notes: 'hi',
      requestedTime: '2026-01-03T05:00:00Z',
    }).expect(201);
    expect(b.body).toEqual(a.body);
    await post({ ...body(), requestId, notes: 'hi' }).expect(409);
  });

  it('lists/filter/paginates safely and denies both original-customer and current-booking IDOR', async () => {
    const a = await post(body()).expect(201);
    await post(body()).expect(201);
    expect(
      (
        await get('/me')
          .query({
            keyword: 'laundry.*',
            reviewStatus: 'PENDING_REVIEW',
            executionStatus: 'NOT_STARTED',
            page: 2,
            limit: 1,
          })
          .expect(200)
      ).body,
    ).toMatchObject({
      total: 2,
      page: 2,
      limit: 1,
      items: [expect.any(Object)],
    });
    for (const query of [
      { reviewStatus: 'INVALID' },
      { executionStatus: 'INVALID' },
      { limit: 101 },
      { page: 0 },
      { extra: 'x' },
    ])
      await get('/me').query(query).expect(400);
    await http()
      .get('/api/v1/service-orders/' + a.body.id)
      .set({ ...auth, 'x-dev-user-id': String(other) })
      .expect(404);
    await bookings.updateOne({ _id: bookingId }, { customer: other });
    await get('/' + a.body.id).expect(404);
    expect((await get('/me').expect(200)).body.total).toBe(0);
    await http()
      .get('/api/v1/service-orders/' + a.body.id)
      .set({ ...auth, 'x-dev-user-id': String(other) })
      .expect(404);
  });

  it('provides only own checked-in context and active safe customer catalog', async () => {
    const contexts = await get('/order-contexts').expect(200);
    expect(contexts.body.items).toHaveLength(1);
    expect(Object.keys(contexts.body.items[0]).sort()).toEqual(
      ['id', 'code', 'checkIn', 'checkOut'].sort(),
    );
    const catalog = await get('/catalog').expect(200);
    expect(catalog.body.items).toEqual([
      {
        id: serviceId,
        name: 'Laundry.*',
        unit: 'kg',
        description: '',
        billable: true,
        unitPriceVND: 50000,
      },
    ]);
    await services.updateOne({ _id: serviceId }, { isActive: false });
    expect((await get('/catalog').expect(200)).body.items).toEqual([]);
    await bookings.updateOne(
      { _id: bookingId },
      { status: BookingStatus.CheckedOut },
    );
    expect((await get('/order-contexts').expect(200)).body.items).toEqual([]);
  });
});
