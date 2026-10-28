import { randomUUID } from 'node:crypto';
import { Logger, VersioningType, type INestApplication } from '@nestjs/common';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Connection, Model, Types } from 'mongoose';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { DashboardClock } from '../src/modules/dashboard/dashboard.service.js';
import { TaskSupervisionClock } from '../src/modules/task-supervision/task-supervision.clock.js';
import { TaskSupervisionService } from '../src/modules/task-supervision/task-supervision.service.js';
import { RevenueReportService } from '../src/modules/reports/revenue-report.service.js';
import { RevenueReportQuery } from '../src/modules/reports/dto/revenue-report.dto.js';
import {
  Task,
  TaskSourceType,
  TaskStatus,
} from '../src/modules/tasks/schemas/task.schema.js';
import { TasksService } from '../src/modules/tasks/tasks.service.js';
import { Room } from '../src/modules/rooms/schemas/room.schema.js';
import { PaymentTransaction } from '../src/modules/payments/schemas/payment-transaction.schema.js';
import { User } from '../src/modules/users/schemas/user.schema.js';
import { Role as RoleModel } from '../src/modules/roles/schemas/role.schema.js';
import { Role } from '../src/common/constants/role.enum.js';
import { SYSTEM_ROLES } from '../src/modules/roles/seed.js';
import { ID_TOKEN_VERIFIER } from '../src/modules/auth/firebase.module.js';
import { assertTestDatabase } from './test-database.js';
describe('Manager dashboard — real sources and isolated Mongo', () => {
  let app: INestApplication,
    connection: Connection,
    tasks: Model<Task>,
    rooms: Model<Room>,
    payments: Model<PaymentTransaction>,
    users: Model<User>,
    roles: Model<RoleModel>;
  const original = process.env.MONGODB_URI;
  const taskIds: Types.ObjectId[] = [],
    roomIds: Types.ObjectId[] = [],
    paymentIds: Types.ObjectId[] = [],
    userIds: Types.ObjectId[] = [],
    roleIds: Types.ObjectId[] = [];
  let manager: Types.ObjectId, ops: Types.ObjectId;
  let now = new Date('2026-10-31T17:00:00Z');
  const base = '/api/v1/dashboard/manager';
  const headers = (role = 'MANAGER', id = manager) => ({
    'x-dev-role': role,
    'x-dev-user-id': String(id),
  });
  const http = () => request(app.getHttpServer());
  const get = () => http().get(base).set(headers());
  const actor = () => ({
    id: String(manager),
    email: 'dashboard-manager@example.test',
    role: Role.Manager,
  });
  async function task(extra: Record<string, unknown> = {}) {
    const row = await tasks.create({
      title: 'Dashboard task private title',
      taskType: 'MAINTENANCE',
      priority: 'NORMAL',
      assignedTo: ops,
      assignedAt: new Date('2026-10-01'),
      sourceType: TaskSourceType.Maintenance,
      sourceId: new Types.ObjectId(),
      dueAt: new Date('2026-10-30'),
      ...extra,
    });
    taskIds.push(row._id);
    return row;
  }
  async function room(status: string, isActive = true) {
    const row = await rooms.create({
      roomNumber: randomUUID(),
      floor: 1,
      roomType: new Types.ObjectId(),
      status,
      isActive,
    });
    roomIds.push(row._id);
    return row;
  }
  async function payment(extra: Record<string, unknown> = {}) {
    const row = await payments.create({
      booking: new Types.ObjectId(),
      invoice: new Types.ObjectId(),
      transactionRef: randomUUID(),
      method: 'CASH',
      purpose: 'FINAL',
      status: 'SUCCESS',
      amount: 1234567,
      paidAt: new Date('2026-10-31T17:00:00Z'),
      ...extra,
    });
    paymentIds.push(row._id);
    return row;
  }
  async function cleanup() {
    if (tasks) await tasks.deleteMany({ _id: { $in: taskIds.splice(0) } });
    if (rooms) await rooms.deleteMany({ _id: { $in: roomIds.splice(0) } });
    if (payments)
      await payments.deleteMany({ _id: { $in: paymentIds.splice(0) } });
  }
  beforeAll(async () => {
    assertTestDatabase(original);
    const uri = new URL(original!);
    uri.pathname = `/hms_dashboard_${randomUUID().replaceAll('-', '')}_test`;
    process.env.MONGODB_URI = uri.toString();
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DashboardClock)
      .useValue({ now: () => new Date(now) })
      .overrideProvider(TaskSupervisionClock)
      .useValue({ now: () => new Date(now) })
      .overrideProvider(ID_TOKEN_VERIFIER)
      .useValue({
        verifyIdToken: async () => ({
          uid: 'dashboard-custom',
          email_verified: true,
          email: 'dashboard-custom@example.test',
        }),
      })
      .compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    SwaggerModule.setup(
      'api/docs',
      app,
      SwaggerModule.createDocument(
        app,
        new DocumentBuilder().setTitle('Dashboard').build(),
      ),
    );
    await app.init();
    connection = app.get(getConnectionToken());
    tasks = app.get(getModelToken(Task.name));
    rooms = app.get(getModelToken(Room.name));
    payments = app.get(getModelToken(PaymentTransaction.name));
    users = app.get(getModelToken(User.name));
    roles = app.get(getModelToken(RoleModel.name));
    await Promise.all(
      Object.values(connection.models).map((model) => model.init()),
    );
    manager = (
      await users.create({
        email: 'dashboard-manager@example.test',
        fullName: 'Dashboard Manager',
        role: 'MANAGER',
      })
    )._id;
    ops = (
      await users.create({
        email: 'dashboard-ops@example.test',
        fullName: 'Dashboard Operator',
        role: 'OPERATIONS_STAFF',
      })
    )._id;
    userIds.push(manager, ops);
  }, 60000);
  beforeEach(async () => {
    await cleanup();
    now = new Date('2026-10-31T17:00:00Z');
  });
  afterEach(() => vi.restoreAllMocks());
  afterAll(async () => {
    await cleanup();
    if (users) await users.deleteMany({ _id: { $in: userIds } });
    if (roles) await roles.deleteMany({ _id: { $in: roleIds } });
    await app?.close();
    if (original === undefined) delete process.env.MONGODB_URI;
    else process.env.MONGODB_URI = original;
  });
  it('reuses exact TaskSupervision counts/overdue and updates immediately after real task transitions', async () => {
    const first = await task();
    await task({
      status: TaskStatus.Completed,
      completedAt: new Date(),
      workResult: 'Done',
    });
    const supervision = app.get(TaskSupervisionService);
    const expected = await supervision.summary({}, actor());
    let { body } = await get().expect(200);
    expect(body.tasks).toEqual({
      available: true,
      counts: {
        assigned: expected.counts.assigned,
        inProgress: expected.counts.inProgress,
        completed: expected.counts.completed,
      },
      overdue: expected.overdue,
    });
    const service = app.get(TasksService);
    await service.transitionAssignedTask(
      String(first._id),
      String(ops),
      TaskStatus.Assigned,
      TaskStatus.InProgress,
    );
    body = (await get().expect(200)).body;
    expect(body.tasks.counts).toEqual({
      assigned: 0,
      inProgress: 1,
      completed: 1,
    });
    await service.transitionAssignedTask(
      String(first._id),
      String(ops),
      TaskStatus.InProgress,
      TaskStatus.Completed,
      'Completed by real Task service',
    );
    expect((await get().expect(200)).body.tasks).toMatchObject({
      counts: { assigned: 0, inProgress: 0, completed: 2 },
      overdue: 0,
    });
  });
  it('counts active rooms with exactly four statuses and preserves zero states', async () => {
    await room('AVAILABLE');
    await room('AVAILABLE');
    await room('OCCUPIED');
    await room('CLEANING', false);
    const { body } = await get().expect(200);
    expect(body.rooms).toEqual({
      available: true,
      activeTotal: 3,
      asOf: now.toISOString(),
      byStatus: { AVAILABLE: 2, OCCUPIED: 1, CLEANING: 0, MAINTENANCE: 0 },
    });
    expect(
      Object.values(body.rooms.byStatus).reduce(
        (a: number, b: unknown) => a + Number(b),
        0,
      ),
    ).toBe(body.rooms.activeTotal);
  });
  it('uses RevenueReportService for the Vietnam month boundary without duplicating formulas', async () => {
    await payment({ paidAt: new Date('2026-10-31T16:59:59Z'), amount: 777 });
    await payment({ amount: 1234567 });
    await payment({ status: 'FAILED', amount: 999999999 });
    const source = app.get(RevenueReportService);
    const report = await source.revenue(
      Object.assign(new RevenueReportQuery(), {
        from: '2026-11-01',
        to: '2026-11-01',
      }),
      actor(),
    );
    const { body } = await get().expect(200);
    expect(body.revenue).toEqual({
      available: true,
      period: {
        from: '2026-11-01',
        to: '2026-11-01',
        timezone: 'Asia/Ho_Chi_Minh',
      },
      successAmount: report.totals.successAmount,
      successCount: report.totals.successCount,
    });
    expect(body.revenue.successAmount).toBe(1234567);
    now = new Date('2026-10-31T16:59:59Z');
    expect((await get().expect(200)).body.revenue).toMatchObject({
      period: { from: '2026-10-01', to: '2026-10-31' },
      successAmount: 777,
    });
  });
  it.each(['tasks', 'rooms', 'revenue'])(
    'isolates %s failure with 200 and no internal error disclosure',
    async (source) => {
      const error = vi
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => {});
      if (source === 'tasks')
        vi.spyOn(app.get(TaskSupervisionService), 'summary').mockRejectedValue(
          new Error('secret connection details'),
        );
      if (source === 'rooms')
        vi.spyOn(rooms, 'aggregate').mockImplementation(() => {
          throw new Error('secret connection details');
        });
      if (source === 'revenue')
        vi.spyOn(app.get(RevenueReportService), 'revenue').mockRejectedValue(
          new Error('secret connection details'),
        );
      const { body } = await get().expect(200);
      expect(body[source]).toEqual({ available: false, reason: 'error' });
      for (const key of ['tasks', 'rooms', 'revenue'])
        if (key !== source) expect(body[key].available).toBe(true);
      expect(JSON.stringify(body)).not.toContain('secret');
      expect(error).toHaveBeenCalledWith({
        event: 'manager_dashboard_source_error',
        source,
        errorName: 'Error',
      });
    },
  );
  it('returns available:true and actual zeros for all existing empty sources', async () => {
    const { body } = await get().expect(200);
    expect(body.tasks).toEqual({
      available: true,
      counts: { assigned: 0, inProgress: 0, completed: 0 },
      overdue: 0,
    });
    expect(body.rooms.activeTotal).toBe(0);
    expect(body.revenue).toMatchObject({
      available: true,
      successAmount: 0,
      successCount: 0,
    });
    expect(Object.values(body.rooms.byStatus)).toEqual([0, 0, 0, 0]);
  });
  it('uses exactly three aggregations regardless of row count and leaves all data/collections unchanged', async () => {
    await task();
    await room('MAINTENANCE');
    await payment();
    const collections = async () =>
      (await connection.db!.listCollections({}, { nameOnly: true }).toArray())
        .map((row) => row.name)
        .sort();
    const snapshot = async () =>
      JSON.stringify(
        await Promise.all([
          tasks.find().sort({ _id: 1 }).lean(),
          rooms.find().sort({ _id: 1 }).lean(),
          payments.find().sort({ _id: 1 }).lean(),
        ]),
      );
    const before = await snapshot(),
      collectionNames = await collections();
    const spies = [
      vi.spyOn(tasks, 'aggregate'),
      vi.spyOn(rooms, 'aggregate'),
      vi.spyOn(payments, 'aggregate'),
    ];
    await get().expect(200);
    for (const spy of spies) expect(spy).toHaveBeenCalledTimes(1);
    expect(await snapshot()).toBe(before);
    for (let i = 0; i < 8; i++) {
      await task();
      await room('AVAILABLE');
      await payment();
    }
    const afterFixtures = await snapshot();
    await get().expect(200);
    await get().expect(200);
    for (const spy of spies) expect(spy).toHaveBeenCalledTimes(3);
    expect(await snapshot()).toBe(afterFixtures);
    expect(await collections()).toEqual(collectionNames);
  });
  it('has aggregate-only Swagger response and no personal data from sources', async () => {
    const row = await task();
    const paid = await payment();
    const { body } = await get().expect(200);
    const text = JSON.stringify(body);
    for (const value of [
      String(row._id),
      row.title,
      String(ops),
      paid.transactionRef,
      'dashboard-ops@example.test',
    ])
      expect(text).not.toContain(value);
    const swagger = (await http().get('/api/docs-json').expect(200)).body;
    const operation = swagger.paths[base].get;
    expect(
      operation.responses['200'].content['application/json'].schema.$ref,
    ).toContain('ManagerDashboard');
    expect(operation.parameters ?? []).toEqual([]);
  });
  it('rejects anonymous users', async () => {
    await http().get(base).expect(401);
  });
  it.each(['CUSTOMER', 'RECEPTIONIST', 'SERVICE_STAFF', 'OPERATIONS_STAFF'])(
    'rejects %s',
    async (role) => {
      await http().get(base).set(headers(role)).expect(403);
    },
  );
  it('rejects a real custom role granted report:view and facility:manage, without widening Manager access', async () => {
    const role = await roles.create({
      code: 'DASHBOARD_CUSTOM',
      name: 'Dashboard custom',
      permissions: ['report:view', 'facility:manage'],
    });
    roleIds.push(role._id);
    const user = await users.create({
      email: 'dashboard-custom@example.test',
      firebaseUid: 'dashboard-custom',
      emailVerified: true,
      fullName: 'Custom Reporter',
      role: 'DASHBOARD_CUSTOM',
    });
    userIds.push(user._id);
    await http()
      .get(base)
      .set('Authorization', 'Bearer custom-fixture-token')
      .expect(403);
    expect(
      SYSTEM_ROLES.filter((role) =>
        role.permissions.includes('report:view'),
      ).map((role) => role.code),
    ).toEqual([Role.Manager]);
  });
  it('rejects query parameters with standard error format', async () => {
    const { body } = await get().query({ from: '2026-11-01' }).expect(400);
    expect(body).toMatchObject({
      statusCode: 400,
      error: expect.any(String),
      path: expect.stringContaining(base),
      timestamp: expect.any(String),
    });
  });
  it.each(['post', 'patch', 'put', 'delete'] as const)(
    'has no %s endpoint',
    async (method) => {
      await http()[method](base).set(headers()).send({}).expect(404);
    },
  );
});
