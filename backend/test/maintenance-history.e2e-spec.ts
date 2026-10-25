import { randomUUID } from 'node:crypto';
import { VersioningType, type INestApplication, Logger } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { Model, Types } from 'mongoose';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { Maintenance } from '../src/modules/maintenance/schemas/maintenance.schema.js';
import { Equipment } from '../src/modules/equipment/schemas/equipment.schema.js';
import { Room } from '../src/modules/rooms/schemas/room.schema.js';
import { RoomType } from '../src/modules/room-types/schemas/room-type.schema.js';
import { User } from '../src/modules/users/schemas/user.schema.js';
import {
  Task,
  TaskStatus,
  TaskSourceType,
} from '../src/modules/tasks/schemas/task.schema.js';
import { TasksService } from '../src/modules/tasks/tasks.service.js';
import { seedMaintenance } from '../src/modules/maintenance/seed.js';
import { assertTestDatabase } from './test-database.js';

describe('UC36 real AppModule scoped, read-only maintenance history', () => {
  let app: INestApplication;
  let reports: Model<Maintenance>;
  let tasks: Model<Task>;
  let users: Model<User>;
  let rooms: Model<Room>;
  let equipment: Model<Equipment>;
  let types: Model<RoomType>;
  let a: Types.ObjectId;
  let b: Types.ObjectId;
  let room: Types.ObjectId;
  let device: Types.ObjectId;
  let type: Types.ObjectId;
  const original = process.env.MONGODB_URI;
  const base = '/api/v1/maintenance/history';
  const headers = (id = a) => ({
    'x-dev-role': 'OPERATIONS_STAFF',
    'x-dev-user-id': String(id),
  });
  const http = () => request(app.getHttpServer());
  const list = (query: object = {}, id = a) =>
    http().get(base).set(headers(id)).query(query);
  const detail = (id: unknown, actor = a) =>
    http().get(`${base}/${id}`).set(headers(actor));
  async function report(
    actor = a,
    action = false,
    extra: Record<string, unknown> = {},
  ) {
    return reports.create({
      reportedBy: actor,
      room,
      equipment: device,
      description: 'Kiểm tra điều hòa [x].*',
      requiresAction: action,
      preventsSafeUse: false,
      requestKey: randomUUID(),
      requestFingerprint: 'fixture',
      ...extra,
    });
  }
  async function withTask(
    reporter: Types.ObjectId,
    assignee: Types.ObjectId,
    status = TaskStatus.Assigned,
  ) {
    const row = await report(reporter, true);
    const service = app.get(TasksService);
    const task = await service.create({
      title: 'UC36 bảo trì',
      taskType: 'MAINTENANCE',
      priority: 'NORMAL',
      sourceType: TaskSourceType.Maintenance,
      sourceId: String(row._id),
      assigneeId: String(assignee),
      dueAt: '2026-12-31T00:00:00Z',
    });
    await reports.updateOne({ _id: row._id }, { $set: { task: task._id } });
    if (status !== TaskStatus.Assigned)
      await service.transitionAssignedTask(
        String(task._id),
        String(assignee),
        TaskStatus.Assigned,
        TaskStatus.InProgress,
      );
    if (status === TaskStatus.Completed)
      await service.transitionAssignedTask(
        String(task._id),
        String(assignee),
        TaskStatus.InProgress,
        TaskStatus.Completed,
        'Đã thay bộ lọc và kiểm tra an toàn',
      );
    return { row, task };
  }
  beforeAll(async () => {
    assertTestDatabase(original);
    const uri = new URL(original!);
    uri.pathname = `/hms_uc36_${randomUUID().replaceAll('-', '')}_test`;
    process.env.MONGODB_URI = uri.toString();
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    SwaggerModule.setup(
      'api/docs',
      app,
      SwaggerModule.createDocument(
        app,
        new DocumentBuilder().setTitle('UC36').build(),
      ),
    );
    await app.init();
    reports = app.get(getModelToken(Maintenance.name));
    tasks = app.get(getModelToken(Task.name));
    users = app.get(getModelToken(User.name));
    rooms = app.get(getModelToken(Room.name));
    equipment = app.get(getModelToken(Equipment.name));
    types = app.get(getModelToken(RoomType.name));
    await Promise.all([
      reports.init(),
      tasks.init(),
      rooms.init(),
      equipment.init(),
    ]);
    a = (
      await users.create({
        email: 'operations@hms.local',
        fullName: 'Ops A',
        phone: '0900000001',
        role: 'OPERATIONS_STAFF',
      })
    )._id;
    b = (
      await users.create({
        email: 'ops-b@uc36.test',
        fullName: 'Ops B',
        phone: '0900000002',
        role: 'OPERATIONS_STAFF',
      })
    )._id;
    type = (
      await types.create({
        name: 'UC36-Type',
        adultCapacity: 2,
        childCapacity: 1,
        basePrice: 100000,
      })
    )._id;
    room = (
      await rooms.create({ roomNumber: 'UC36-102', floor: 2, roomType: type })
    )._id;
    device = (
      await equipment.create({
        assetCode: 'UC36-AC',
        name: 'Điều hòa [x].*',
        category: 'Điện',
        location: 'Tầng 2',
        room,
      })
    )._id;
  }, 60000);
  beforeEach(async () => {
    const ids = (
      await reports.find({ reportedBy: { $in: [a, b] } }).select('_id')
    ).map((r) => r._id);
    await tasks.deleteMany({
      sourceType: 'MAINTENANCE',
      sourceId: { $in: ids },
    });
    await reports.deleteMany({ reportedBy: { $in: [a, b] } });
  });
  afterEach(() => vi.restoreAllMocks());
  afterAll(async () => {
    if (reports) {
      const ids = (
        await reports.find({ reportedBy: { $in: [a, b] } }).select('_id')
      ).map((r) => r._id);
      await tasks.deleteMany({
        sourceType: 'MAINTENANCE',
        sourceId: { $in: ids },
      });
      await reports.deleteMany({ reportedBy: { $in: [a, b] } });
    }
    await equipment?.deleteMany({ _id: device });
    await rooms?.deleteMany({ _id: room });
    await types?.deleteOne({ _id: type });
    await users?.deleteMany({ _id: { $in: [a, b] } });
    await app?.close();
    if (original === undefined) delete process.env.MONGODB_URI;
    else process.env.MONGODB_URI = original;
  });
  it('only includes own reports or linked tasks assigned to actor, with identical detail scope', async () => {
    const own = await report(a);
    const assigned = await withTask(b, a);
    const hidden = await withTask(b, b);
    const result = (await list().expect(200)).body;
    expect(result.total).toBe(2);
    expect(result.items.map((r: any) => r.id).sort()).toEqual(
      [String(own._id), String(assigned.row._id)].sort(),
    );
    await detail(own._id).expect(200);
    await detail(assigned.row._id).expect(200);
    const outside = await detail(hidden.row._id).expect(404);
    const missing = await detail(new Types.ObjectId()).expect(404);
    expect(outside.body.message).toEqual(missing.body.message);
    expect((await list({}, b).expect(200)).body.total).toBe(2);
  });
  it.each([TaskStatus.Assigned, TaskStatus.InProgress, TaskStatus.Completed])(
    'derives %s from real TasksService work without exposing contact details',
    async (status) => {
      const { row } = await withTask(a, b, status);
      const data = (await detail(row._id).expect(200)).body;
      expect(data.status).toBe(status);
      expect(data.task.assignee).toEqual({ id: String(b), fullName: 'Ops B' });
      expect(data.reportedBy).toEqual({ id: String(a), fullName: 'Ops A' });
      expect(JSON.stringify(data)).not.toMatch(
        /email|phone|requestKey|requestFingerprint|receipt|taskIdentity/,
      );
      expect(data.target.equipment).toMatchObject({
        category: 'Điện',
        location: 'Tầng 2',
      });
      if (status === TaskStatus.Completed) {
        expect(data.completedAt).toBe(data.task.completedAt);
        expect(data.task.workResult).toContain('Đã thay');
      }
      expect((await list({ status }).expect(200)).body.total).toBe(1);
      expect((await list({ status: 'NO_ACTION' }).expect(200)).body.total).toBe(
        0,
      );
    },
  );
  it('returns NO_ACTION and handles missing task/room/equipment without inventing completion', async () => {
    await report();
    const orphan = await report(a, true, {
      task: new Types.ObjectId(),
      room: new Types.ObjectId(),
      equipment: new Types.ObjectId(),
    });
    const warn = vi.spyOn(Logger.prototype, 'warn');
    const data = (await list().expect(200)).body;
    expect(
      data.items.find((r: any) => r.id === String(orphan._id)),
    ).toMatchObject({ status: null, target: { room: null, equipment: null } });
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'maintenance_history_missing_task' }),
    );
    expect((await detail(orphan._id).expect(200)).body.task).toBeNull();
    expect((await list({ status: 'NO_ACTION' }).expect(200)).body.total).toBe(
      1,
    );
  });
  it('does not grant scope through a corrupt link to another maintenance source', async () => {
    const legitimate = await withTask(b, a);
    const invalid = await report(b, true, { task: legitimate.task._id });
    await detail(invalid._id).expect(404);
    expect((await list().expect(200)).body.total).toBe(1);
  });
  it.each(['[x].*', 'uc36-102', 'uc36-ac', 'điều hòa'])(
    'searches literal %s before counting',
    async (q) => {
      await report();
      await report(b);
      await report(a, false, {
        description: 'Khác',
        room: undefined,
        equipment: undefined,
        facilityLocation: 'Sảnh',
      });
      const data = (await list({ q }).expect(200)).body;
      expect(data.total).toBe(1);
      expect(data.items).toHaveLength(1);
    },
  );
  it('searches facility location and reports empty scoped history', async () => {
    expect((await list().expect(200)).body).toEqual({
      items: [],
      total: 0,
      page: 1,
      limit: 10,
    });
    await report(a, false, { facilityLocation: 'Sảnh chung' });
    expect((await list({ q: 'SẢNH CHUNG' }).expect(200)).body.total).toBe(1);
    expect((await list({ q: 'không có' }).expect(200)).body.items).toEqual([]);
  });
  it('filters half-open Vietnam day boundaries, paginates and sorts deterministically', async () => {
    const instants = [
      '2026-10-24T16:59:59.999Z',
      '2026-10-24T17:00:00.000Z',
      '2026-10-25T16:59:59.999Z',
      '2026-10-25T17:00:00.000Z',
    ];
    for (const instant of instants)
      await report(a, false, { createdAt: new Date(instant) });
    const query = {
      from: '2026-10-25',
      to: '2026-10-25',
      sort: 'asc',
      limit: 1,
    };
    const first = (await list(query).expect(200)).body;
    const second = (await list({ ...query, page: 2 }).expect(200)).body;
    expect(first.total).toBe(2);
    expect(first.items[0].reportedAt).toBe(instants[1]);
    expect(second.items[0].reportedAt).toBe(instants[2]);
    expect(
      (await list({ ...query, sort: 'desc' }).expect(200)).body.items[0].id,
    ).toBe(second.items[0].id);
  });
  it.each([
    { page: 0 },
    { limit: 1000 },
    { status: 'UNKNOWN' },
    { unknown: true },
    { from: '2026-02-30' },
    { from: '2026-10-26', to: '2026-10-25' },
    { q: 'x'.repeat(101) },
    { from: '25/10/2026' },
  ])('rejects invalid query %j in standard format', async (query) => {
    expect((await list(query).expect(400)).body).toMatchObject({
      statusCode: 400,
      message: expect.anything(),
      error: expect.any(String),
      path: expect.stringContaining(base),
      timestamp: expect.any(String),
    });
  });
  it('validates identifiers and authenticates both endpoints', async () => {
    const row = await report();
    await detail('invalid').expect(400);
    await detail(new Types.ObjectId()).expect(404);
    await http().get(base).expect(401);
    await http().get(`${base}/${row._id}`).expect(401);
    for (const role of ['CUSTOMER', 'RECEPTIONIST', 'SERVICE_STAFF', 'MANAGER'])
      for (const path of [base, `${base}/${row._id}`])
        await http()
          .get(path)
          .set({ 'x-dev-role': role, 'x-dev-user-id': String(a) })
          .expect(403);
  });
  it('has no write routes and repeated reads leave every business record unchanged', async () => {
    const { row } = await withTask(a, a, TaskStatus.Completed);
    const snapshot = async () =>
      JSON.stringify(
        await Promise.all([
          reports.find().sort({ _id: 1 }).lean(),
          tasks.find().sort({ _id: 1 }).lean(),
          rooms.find().sort({ _id: 1 }).lean(),
          equipment.find().sort({ _id: 1 }).lean(),
        ]),
      );
    const before = await snapshot();
    for (let i = 0; i < 3; i++) {
      await list().expect(200);
      await detail(row._id).expect(200);
    }
    for (const method of ['post', 'put', 'patch', 'delete'] as const)
      for (const path of [base, `${base}/${row._id}`])
        await http()
          [method](path)
          .set(headers())
          .send({ description: 'Không được sửa' })
          .expect(404);
    expect(await snapshot()).toBe(before);
  });
  it('uses one aggregation for one or many rows, with filtered count and required indexes', async () => {
    await report();
    const aggregate = vi.spyOn(reports, 'aggregate');
    await list().expect(200);
    expect(aggregate).toHaveBeenCalledTimes(1);
    for (let i = 0; i < 12; i++) await report();
    aggregate.mockClear();
    const page = (await list({ limit: 10 }).expect(200)).body;
    expect(page.total).toBe(13);
    expect(page.items).toHaveLength(10);
    expect(aggregate).toHaveBeenCalledTimes(1);
    const indexes = await reports.collection.indexes();
    expect(indexes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: { reportedBy: 1, createdAt: -1 } }),
        expect.objectContaining({ key: { task: 1 } }),
      ]),
    );
  });
  it('seeds NO_ACTION observations twice without overwriting edits, timestamps or version', async () => {
    await seedMaintenance(app);
    expect(await reports.countDocuments()).toBe(1); // room/equipment sample dependencies deliberately absent
    const sample = await reports.findOne().orFail();
    await reports.updateOne(
      { _id: sample._id },
      { $set: { description: 'Đã chỉnh' }, $inc: { __v: 1 } },
    );
    const before = await reports.find().lean();
    await seedMaintenance(app);
    await seedMaintenance(app);
    expect(await reports.find().lean()).toEqual(before);
    expect(await tasks.countDocuments()).toBe(0);
    expect((await list({ status: 'NO_ACTION' }).expect(200)).body.total).toBe(
      1,
    );
  });
  it('documents both GET routes with response schemas on real Swagger', async () => {
    const result = await http().get('/api/docs-json').expect(200);
    expect(
      result.body.paths[base].get.responses['200'].content['application/json']
        .schema,
    ).toHaveProperty('$ref');
    expect(result.body.paths[`${base}/{id}`].get).toBeDefined();
    await http().get('/api/docs/').expect(200);
  });
});
