import { randomUUID } from 'node:crypto';
import { Logger, VersioningType, type INestApplication } from '@nestjs/common';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Connection, Model, Types } from 'mongoose';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import {
  Task,
  TaskSourceType,
  TaskStatus,
} from '../src/modules/tasks/schemas/task.schema.js';
import { TasksService } from '../src/modules/tasks/tasks.service.js';
import { User } from '../src/modules/users/schemas/user.schema.js';
import { Maintenance } from '../src/modules/maintenance/schemas/maintenance.schema.js';
import { Room } from '../src/modules/rooms/schemas/room.schema.js';
import { RoomType } from '../src/modules/room-types/schemas/room-type.schema.js';
import { Equipment } from '../src/modules/equipment/schemas/equipment.schema.js';
import { TaskSupervisionClock } from '../src/modules/task-supervision/task-supervision.clock.js';
import { assertTestDatabase } from './test-database.js';

describe('UC55 live queue supervision — real AppModule and Task lifecycle', () => {
  let app: INestApplication;
  let connection: Connection;
  let tasks: Model<Task>;
  let users: Model<User>;
  let reports: Model<Maintenance>;
  let rooms: Model<Room>;
  let equipment: Model<Equipment>;
  let types: Model<RoomType>;
  let a: Types.ObjectId;
  let b: Types.ObjectId;
  let manager: Types.ObjectId;
  let room: Types.ObjectId;
  let device: Types.ObjectId;
  let type: Types.ObjectId;
  const taskIds: Types.ObjectId[] = [];
  const reportIds: Types.ObjectId[] = [];
  const original = process.env.MONGODB_URI;
  const now = new Date('2027-02-01T03:00:00Z');
  const base = '/api/v1/task-queues';
  const headers = () => ({
    'x-dev-role': 'MANAGER',
    'x-dev-user-id': String(manager),
  });
  const http = () => request(app.getHttpServer());
  const summary = (query: object = {}) =>
    http()
      .get(base + '/summary')
      .set(headers())
      .query(query);
  const list = (query: object = {}) =>
    http()
      .get(base + '/tasks')
      .set(headers())
      .query(query);
  const detail = (id: unknown) =>
    http().get(`${base}/tasks/${id}`).set(headers());
  async function source() {
    const row = await reports.create({
      reportedBy: a,
      room,
      equipment: device,
      description: 'UC55 nguồn bảo trì',
      requiresAction: true,
      preventsSafeUse: true,
      requestKey: randomUUID(),
      requestFingerprint: 'UC55 fixture',
    });
    reportIds.push(row._id);
    return row;
  }
  async function make(
    input: {
      priority?: string;
      taskType?: string;
      title?: string;
      assignee?: Types.ObjectId;
      dueAt?: string;
      assignedAt?: Date;
    } = {},
  ) {
    const report = await source();
    const task = await app.get(TasksService).create(
      {
        title: input.title ?? 'Kiểm tra [x].*',
        taskType: input.taskType ?? 'MAINTENANCE',
        priority: input.priority ?? 'NORMAL',
        sourceType: TaskSourceType.Maintenance,
        sourceId: String(report._id),
        assigneeId: String(input.assignee ?? a),
        ...(input.dueAt ? { dueAt: input.dueAt } : {}),
      },
      undefined,
      input.assignedAt,
    );
    taskIds.push(task._id);
    return task;
  }
  // A schema-valid Task fixture for reference-only source types; no Issue/ServiceOrder writes or dependencies.
  async function fixture(extra: Record<string, unknown> = {}) {
    const row = await tasks.create({
      title: 'UC55 reference task',
      taskType: 'REFERENCE',
      priority: 'NORMAL',
      assignedTo: a,
      assignedAt: new Date('2026-10-25T00:00:00Z'),
      sourceType: TaskSourceType.Issue,
      sourceId: new Types.ObjectId(),
      ...extra,
    });
    taskIds.push(row._id);
    return row;
  }
  async function cleanup() {
    if (tasks) await tasks.deleteMany({ _id: { $in: taskIds.splice(0) } });
    if (reports)
      await reports.deleteMany({ _id: { $in: reportIds.splice(0) } });
  }
  beforeAll(async () => {
    assertTestDatabase(original);
    const uri = new URL(original!);
    uri.pathname = `/hms_uc55_${randomUUID().replaceAll('-', '')}_test`;
    process.env.MONGODB_URI = uri.toString();
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(TaskSupervisionClock)
      .useValue({ now: () => new Date(now) })
      .compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    SwaggerModule.setup(
      'api/docs',
      app,
      SwaggerModule.createDocument(
        app,
        new DocumentBuilder().setTitle('UC55').build(),
      ),
    );
    await app.init();
    connection = app.get(getConnectionToken());
    tasks = app.get(getModelToken(Task.name));
    users = app.get(getModelToken(User.name));
    reports = app.get(getModelToken(Maintenance.name));
    rooms = app.get(getModelToken(Room.name));
    equipment = app.get(getModelToken(Equipment.name));
    types = app.get(getModelToken(RoomType.name));
    await Promise.all(
      Object.values(connection.models).map((model) => model.init()),
    );
    a = (
      await users.create({
        email: 'uc55-a@example.test',
        fullName: 'Ops A',
        phone: '0901111111',
        role: 'OPERATIONS_STAFF',
      })
    )._id;
    b = (
      await users.create({
        email: 'uc55-b@example.test',
        fullName: 'Ops B',
        phone: '0902222222',
        role: 'OPERATIONS_STAFF',
      })
    )._id;
    manager = (
      await users.create({
        email: 'uc55-manager@example.test',
        fullName: 'Manager',
        role: 'MANAGER',
      })
    )._id;
    type = (
      await types.create({
        name: 'UC55 Type',
        adultCapacity: 2,
        childCapacity: 1,
        basePrice: 100000,
      })
    )._id;
    room = (
      await rooms.create({ roomNumber: 'UC55-102', floor: 1, roomType: type })
    )._id;
    device = (
      await equipment.create({
        assetCode: 'UC55-AC',
        name: 'Điều hòa UC55',
        category: 'Điện',
        room,
      })
    )._id;
  }, 60000);
  beforeEach(cleanup);
  afterEach(() => vi.restoreAllMocks());
  afterAll(async () => {
    await cleanup();
    await equipment?.deleteOne({ _id: device });
    await rooms?.deleteOne({ _id: room });
    await types?.deleteOne({ _id: type });
    await users?.deleteMany({ _id: { $in: [a, b, manager] } });
    await app?.close();
    if (original === undefined) delete process.env.MONGODB_URI;
    else process.env.MONGODB_URI = original;
  });
  it('BR-SUP-02 recomputes immediately after real Task transitions, without any new collection or stored counter', async () => {
    const first = await make();
    await make({ assignee: b });
    const collections = async () =>
      (await connection.db!.listCollections({}, { nameOnly: true }).toArray())
        .map((c) => c.name)
        .sort();
    const beforeCollections = await collections();
    expect((await summary().expect(200)).body.counts).toEqual({
      assigned: 2,
      inProgress: 0,
      completed: 0,
      other: 0,
      total: 2,
    });
    const service = app.get(TasksService);
    await service.transitionAssignedTask(
      String(first._id),
      String(a),
      TaskStatus.Assigned,
      TaskStatus.InProgress,
    );
    expect((await summary().expect(200)).body.counts).toMatchObject({
      assigned: 1,
      inProgress: 1,
      completed: 0,
      total: 2,
    });
    expect((await list({ status: 'IN_PROGRESS' }).expect(200)).body.total).toBe(
      1,
    );
    await service.transitionAssignedTask(
      String(first._id),
      String(a),
      TaskStatus.InProgress,
      TaskStatus.Completed,
      'Đã kiểm tra và xử lý an toàn',
    );
    const snapshot = JSON.stringify(await tasks.find().sort({ _id: 1 }).lean());
    const final = (await summary().expect(200)).body;
    const page = (await list().expect(200)).body;
    expect(final.counts).toEqual({
      assigned: 1,
      inProgress: 0,
      completed: 1,
      other: 0,
      total: 2,
    });
    expect(final.counts.total).toBe(page.total);
    expect(final.generatedAt).toBe(now.toISOString());
    expect(await collections()).toEqual(beforeCollections);
    expect(JSON.stringify(await tasks.find().sort({ _id: 1 }).lean())).toBe(
      snapshot,
    );
    const row = (await detail(first._id).expect(200)).body;
    expect(row.workResult).toContain('Đã kiểm tra');
    expect(row.completedAt).toBeTruthy();
    for (const field of ['counts', 'workload', 'overdue', 'sortNull'])
      expect(await tasks.findById(first._id).lean()).not.toHaveProperty(field);
  });
  it('returns empty counts, facets, workload and task list without seed tasks', async () => {
    expect((await summary().expect(200)).body).toEqual({
      counts: { assigned: 0, inProgress: 0, completed: 0, other: 0, total: 0 },
      overdue: 0,
      workload: [],
      facets: { taskTypes: [], priorities: [] },
      generatedAt: now.toISOString(),
    });
    expect((await list().expect(200)).body).toEqual({
      items: [],
      total: 0,
      page: 1,
      limit: 10,
    });
  });
  it('filters priority by exact case-sensitive equality, including regex punctuation; facets remain data-derived', async () => {
    for (const priority of ['HIGH', 'high', 'RUSH.*[x]', 'RUSH-extra'])
      await make({ priority });
    for (const priority of ['HIGH', 'high', 'RUSH.*[x]']) {
      expect((await summary({ priority }).expect(200)).body.counts.total).toBe(
        1,
      );
      expect((await list({ priority }).expect(200)).body.total).toBe(1);
    }
    expect((await list({ priority: 'RUSH' }).expect(200)).body.total).toBe(0);
    expect(
      (
        await summary({ priority: 'HIGH' }).expect(200)
      ).body.facets.priorities.sort(),
    ).toEqual(['HIGH', 'high', 'RUSH.*[x]', 'RUSH-extra'].sort());
    await make({ priority: 'CUSTOM NEW', taskType: 'CUSTOM TYPE' });
    const facets = (await summary().expect(200)).body.facets;
    expect(facets.priorities).toContain('CUSTOM NEW');
    expect(facets.taskTypes).toEqual(['CUSTOM TYPE', 'MAINTENANCE']);
  });
  it('respects taskType, sourceType, assigneeId and escaped case-insensitive title search in both endpoints', async () => {
    await make({ assignee: a, taskType: 'REPAIR', title: 'Kiểm tra [x].*' });
    await make({ assignee: b, taskType: 'REPAIR', title: 'Khác' });
    await fixture({ taskType: 'ISSUE_WORK' });
    for (const query of [
      { taskType: 'REPAIR', assigneeId: String(a) },
      { sourceType: 'MAINTENANCE', q: 'KIỂM TRA [X].*' },
      { sourceType: 'ISSUE', taskType: 'ISSUE_WORK' },
    ]) {
      expect((await summary(query).expect(200)).body.counts.total).toBe(1);
      expect((await list(query).expect(200)).body.total).toBe(1);
    }
    expect(
      (await summary({ q: 'not-present' }).expect(200)).body.counts.total,
    ).toBe(0);
  });
  it('uses the injected clock: equality/not-due/completed are not overdue, and summary matches overdue=true list', async () => {
    await make({ dueAt: new Date(now.getTime() - 1).toISOString() });
    await make({ dueAt: now.toISOString() });
    await make({ dueAt: new Date(now.getTime() + 1).toISOString() });
    await make();
    const done = await make({ dueAt: '2020-01-01T00:00:00Z' });
    const service = app.get(TasksService);
    await service.transitionAssignedTask(
      String(done._id),
      String(a),
      TaskStatus.Assigned,
      TaskStatus.InProgress,
    );
    await service.transitionAssignedTask(
      String(done._id),
      String(a),
      TaskStatus.InProgress,
      TaskStatus.Completed,
      'Xong',
    );
    const counts = (await summary().expect(200)).body;
    expect(counts.overdue).toBe(1);
    expect((await list({ overdue: true }).expect(200)).body.total).toBe(1);
    expect((await list({ overdue: false }).expect(200)).body.total).toBe(4);
    expect((await detail(done._id).expect(200)).body.overdue).toBe(false);
  });
  it('groups workload for multiple staff, sorts open work descending and projects only id/fullName/role', async () => {
    await make({ assignee: a });
    await make({ assignee: b });
    await make({ assignee: b });
    const data = (await summary().expect(200)).body;
    expect(data.workload.map((r: any) => r.assignee.id)).toEqual([
      String(b),
      String(a),
    ]);
    expect(data.workload[0].assigned).toBe(2);
    expect(Object.keys(data.workload[0].assignee).sort()).toEqual([
      'fullName',
      'id',
      'role',
    ]);
    expect(JSON.stringify(data)).not.toMatch(
      /email|phone|0901111111|0902222222/,
    );
    expect((await list({ assigneeId: String(b) }).expect(200)).body.total).toBe(
      2,
    );
  });
  it.each(['assignedAt', 'dueAt', 'completedAt'])(
    'sorts %s with null/missing last in both directions and paginates after filtering',
    async (field) => {
      const early = await fixture({
        assignedAt: new Date('2026-01-01'),
        dueAt: new Date('2026-01-01'),
        completedAt: new Date('2026-01-01'),
        status: 'COMPLETED',
        workResult: 'Early',
      });
      const late = await fixture({
        assignedAt: new Date('2026-02-01'),
        dueAt: new Date('2026-02-01'),
        completedAt: new Date('2026-02-01'),
        status: 'COMPLETED',
        workResult: 'Late',
      });
      const missing = await fixture();
      await tasks.collection.updateOne(
        { _id: missing._id },
        { $unset: { assignedAt: 1, dueAt: 1, completedAt: 1 } },
      );
      for (const [sortOrder, expected] of [
        ['asc', [early, late, missing]],
        ['desc', [late, early, missing]],
      ] as const) {
        const result = (await list({ sortBy: field, sortOrder }).expect(200))
          .body;
        expect(result.items.map((r: any) => r.id)).toEqual(
          expected.map((r) => String(r._id)),
        );
        expect(result.total).toBe(3);
      }
      const second = (
        await list({
          sortBy: field,
          sortOrder: 'asc',
          limit: 1,
          page: 2,
        }).expect(200)
      ).body;
      expect(second.total).toBe(3);
      expect(second.items[0].id).toBe(String(late._id));
    },
  );
  it('handles missing assignees and missing priority without failing; counts unknown legacy statuses explicitly', async () => {
    const task = await make();
    await tasks.collection.updateOne(
      { _id: task._id },
      {
        $set: { assignedTo: new Types.ObjectId(), status: 'LEGACY' },
        $unset: { priority: 1 },
      },
    );
    const warning = vi.spyOn(Logger.prototype, 'warn');
    const data = (await summary().expect(200)).body;
    expect(data.counts).toMatchObject({
      assigned: 0,
      inProgress: 0,
      completed: 0,
      other: 1,
      total: 1,
    });
    expect(data.workload[0].assignee).toBeNull();
    expect((await list().expect(200)).body.items[0]).toMatchObject({
      assignee: null,
      priority: null,
    });
    expect((await detail(task._id).expect(200)).body.assignee).toBeNull();
    expect(warning).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'task_supervision_missing_assignee' }),
    );
  });
  it('caps workload at 100 groups while counts and pagination still cover all tasks', async () => {
    const report = await source();
    const data = Array.from({ length: 101 }, (_, i) => ({
      title: `Load ${i}`,
      taskType: `UC55-${i}`,
      priority: 'NORMAL',
      status: 'ASSIGNED',
      assignedTo: new Types.ObjectId(),
      assignedAt: now,
      sourceType: 'MAINTENANCE',
      sourceId: report._id,
    }));
    const rows = await tasks.insertMany(data);
    taskIds.push(...rows.map((r) => r._id));
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    const result = (await summary().expect(200)).body;
    expect(result.counts.total).toBe(101);
    expect(result.workload).toHaveLength(100);
    const page = (await list({ page: 2, limit: 100 }).expect(200)).body;
    expect(page.total).toBe(101);
    expect(page.items).toHaveLength(1);
  });
  it('only expands MAINTENANCE source; ISSUE and SERVICE_ORDER remain references', async () => {
    const task = await make();
    const data = (await detail(task._id).expect(200)).body;
    expect(data.sourceSummary).toEqual({
      description: 'UC55 nguồn bảo trì',
      room: { roomNumber: 'UC55-102' },
      equipment: { assetCode: 'UC55-AC', name: 'Điều hòa UC55' },
      preventsSafeUse: true,
    });
    expect(data).not.toHaveProperty('workResult');
    for (const sourceType of ['ISSUE', 'SERVICE_ORDER']) {
      const ref = await fixture({ sourceType, sourceId: task.sourceId });
      const result = (await detail(ref._id).expect(200)).body;
      expect(result.source).toEqual({
        sourceType,
        sourceId: String(task.sourceId),
      });
      expect(result.sourceSummary).toBeNull();
    }
  });
  it('requires Manager for every endpoint even though staff have task:execute', async () => {
    const task = await make();
    for (const path of [
      base + '/summary',
      base + '/tasks',
      `${base}/tasks/${task._id}`,
    ]) {
      await http().get(path).expect(401);
      for (const role of [
        'CUSTOMER',
        'RECEPTIONIST',
        'SERVICE_STAFF',
        'OPERATIONS_STAFF',
      ])
        await http()
          .get(path)
          .set({ 'x-dev-role': role, 'x-dev-user-id': String(a) })
          .expect(403);
      await http().get(path).set(headers()).expect(200);
    }
    await detail('bad').expect(400);
    await detail(new Types.ObjectId()).expect(404);
  });
  it.each([
    { status: 'PENDING' },
    { page: 0 },
    { limit: 1000 },
    { sortBy: 'priority' },
    { sortBy: 'title' },
    { priority: ' ' },
    { priority: 'x'.repeat(101) },
    { assigneeId: 'bad' },
    { sourceType: 'OTHER' },
    { overdue: '1' },
    { unknown: true },
  ])('rejects invalid list query %j using standard errors', async (query) => {
    expect((await list(query).expect(400)).body).toMatchObject({
      statusCode: 400,
      message: expect.anything(),
      error: expect.any(String),
      path: expect.stringContaining(base + '/tasks'),
      timestamp: expect.any(String),
    });
  });
  it('rejects status and overdue on summary rather than hiding other queue counts', async () => {
    await summary({ status: 'ASSIGNED' }).expect(400);
    await summary({ overdue: true }).expect(400);
    await summary({ unknown: 1 }).expect(400);
  });
  it('uses one aggregation for each endpoint regardless of page size and never writes on reads', async () => {
    const task = await make();
    const aggregate = vi.spyOn(tasks, 'aggregate');
    await summary().expect(200);
    await list().expect(200);
    await detail(task._id).expect(200);
    expect(aggregate).toHaveBeenCalledTimes(3);
    for (let i = 0; i < 12; i++) await make();
    aggregate.mockClear();
    const snapshot = async () =>
      JSON.stringify(
        await Promise.all([
          tasks.find().sort({ _id: 1 }).lean(),
          users.find().sort({ _id: 1 }).lean(),
          reports.find().sort({ _id: 1 }).lean(),
        ]),
      );
    const before = await snapshot();
    await summary().expect(200);
    await list({ limit: 100 }).expect(200);
    await detail(task._id).expect(200);
    expect(aggregate).toHaveBeenCalledTimes(3);
    expect(await snapshot()).toBe(before);
    for (const method of ['post', 'put', 'patch', 'delete'] as const)
      for (const path of [
        base,
        base + '/summary',
        base + '/tasks',
        `${base}/tasks/${task._id}`,
      ])
        await http()
          [method](path)
          .set(headers())
          .send({ status: 'COMPLETED' })
          .expect(404);
    expect(await snapshot()).toBe(before);
  });
  it('documents all three GET endpoints on real Swagger', async () => {
    const doc = (await http().get('/api/docs-json').expect(200)).body;
    for (const path of ['/summary', '/tasks', '/tasks/{id}'])
      expect(
        doc.paths[base + path].get.responses['200'].content['application/json']
          .schema,
      ).toHaveProperty('$ref');
    await http().get('/api/docs/').expect(200);
  });
});
