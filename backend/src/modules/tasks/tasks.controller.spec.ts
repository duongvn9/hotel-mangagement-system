import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { Types } from 'mongoose';
import request from 'supertest';
import { AuthGuard } from '../auth/auth.guard.js';
import { ID_TOKEN_VERIFIER } from '../auth/firebase.module.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Role } from '../roles/schemas/role.schema.js';
import { User } from '../users/schemas/user.schema.js';
import { Task } from './schemas/task.schema.js';
import { TaskSourceType, TaskStatus } from './task-contract.js';
import { TasksController } from './tasks.controller.js';
import { TasksService } from './tasks.service.js';

const alice = new Types.ObjectId();
const bob = new Types.ObjectId();
const taskId = new Types.ObjectId();
const otherId = new Types.ObjectId();
const assignedAt = new Date('2026-10-20T12:00:00.000Z');
const sourceId = new Types.ObjectId();
const records: (Task & { _id: Types.ObjectId; secret?: string })[] = [
  {
    _id: taskId,
    assignedTo: alice,
    title: 'Deliver [towels]',
    taskType: 'SERVICE',
    priority: 'NORMAL',
    status: TaskStatus.Assigned,
    assignedAt,
    sourceId,
    sourceType: TaskSourceType.ServiceOrder,
    secret: 'never return',
  },
  {
    _id: otherId,
    assignedTo: bob,
    title: 'Repair fan',
    taskType: 'MAINTENANCE',
    priority: 'HIGH',
    status: TaskStatus.InProgress,
    assignedAt,
    sourceId: new Types.ObjectId(),
    sourceType: TaskSourceType.Maintenance,
  },
];
const matches = (row: (typeof records)[number], filter: Record<string, any>) =>
  Object.entries(filter).every(([key, value]) =>
    key === 'title'
      ? new RegExp(value.$regex, value.$options).test(row.title)
      : String(row[key as keyof typeof row]) === String(value),
  );

function queryChain(rows: typeof records) {
  const chain = {
    select: vi.fn(() => chain),
    sort: vi.fn(() => chain),
    skip: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    lean: vi.fn(async () => rows),
  };
  return chain;
}

describe('UC37 isolated HTTP with real authentication and role guards', () => {
  let app: INestApplication;
  const find = vi.fn((filter: Record<string, any>) =>
    queryChain(records.filter((row) => matches(row, filter))),
  );
  const findOne = vi.fn((filter: Record<string, any>) => {
    const chain = {
      select: vi.fn(() => chain),
      lean: async () => records.find((row) => matches(row, filter)) ?? null,
    };
    return chain;
  });
  const findOneAndUpdate = vi.fn(
    async (filter: Record<string, any>, update: any) => {
      const row = records.find((item) => matches(item, filter));
      if (!row) return null;
      Object.assign(row, update.$set);
      return row;
    },
  );
  const createIndex = vi.fn(async () => 'unique_active_task_work');
  const countDocuments = vi.fn(
    async (filter: Record<string, any>) =>
      records.filter((row) => matches(row, filter)).length,
  );
  const sourceAccess = vi.fn();
  const roleExists = vi.fn(async ({ code, isActive, permissions }: any) =>
    code === 'CUSTOM_EXECUTOR' &&
    isActive &&
    permissions.$all.join() === 'task:execute'
      ? { _id: 'role' }
      : null,
  );
  let transitionRole = 'SERVICE_STAFF';
  const users = {
    findById: vi.fn((id: string) => ({
      lean: async () => ({
        role: id === String(bob) ? 'OPERATIONS_STAFF' : transitionRole,
        isActive: true,
      }),
    })),
    findOne: vi.fn(({ firebaseUid }: { firebaseUid: string }) => ({
      lean: async () => ({
        _id: firebaseUid === 'bob' ? bob : alice,
        email: `${firebaseUid}@test.invalid`,
        role: (
          {
            alice: 'SERVICE_STAFF',
            bob: 'OPERATIONS_STAFF',
            custom: 'CUSTOM_EXECUTOR',
            denied: 'CUSTOM_DENIED',
            manager: 'MANAGER',
          } as Record<string, string>
        )[firebaseUid],
        isActive: true,
        emailVerified: true,
      }),
    })),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [TasksController],
      providers: [
        TasksService,
        {
          provide: getModelToken(Task.name),
          useValue: {
            find,
            findOne,
            countDocuments,
            findOneAndUpdate,
            collection: { createIndex },
          },
        },
        { provide: getModelToken(User.name), useValue: users },
        { provide: getModelToken(Role.name), useValue: { exists: roleExists } },
        {
          provide: getConnectionToken(),
          useValue: { collection: sourceAccess },
        },
        {
          provide: ID_TOKEN_VERIFIER,
          useValue: {
            verifyIdToken: async (token: string) => {
              if (token === 'invalid') throw new Error('Invalid token');
              return { uid: token, email_verified: true };
            },
          },
        },
        { provide: APP_GUARD, useClass: AuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  });
  afterAll(async () => {
    await app?.close();
  });
  beforeEach(() => {
    vi.clearAllMocks();
    transitionRole = 'SERVICE_STAFF';
    records[0].status = TaskStatus.Assigned;
    delete records[0].workResult;
    delete records[0].completedAt;
  });
  const get = (path = '/tasks/me', actor = 'alice') =>
    request(app.getHttpServer()).get(path).auth(actor, { type: 'bearer' });

  it('requires authentication for both routes', async () => {
    for (const path of ['/tasks/me', `/tasks/${taskId}`]) {
      await request(app.getHttpServer()).get(path).expect(401);
      await get(path, 'invalid').expect(401);
    }
    expect(find).not.toHaveBeenCalled();
    expect(findOne).not.toHaveBeenCalled();
  });

  it('allows built-in staff OR an active role with task:execute; denies others', async () => {
    for (const actor of ['alice', 'bob', 'custom']) {
      await get('/tasks/me', actor).expect(200);
      await get(`/tasks/${actor === 'bob' ? otherId : taskId}`, actor).expect(
        200,
      );
    }
    expect(roleExists).toHaveBeenCalledWith({
      code: 'CUSTOM_EXECUTOR',
      isActive: true,
      permissions: { $all: ['task:execute'] },
    });
    for (const actor of ['denied', 'manager']) {
      await get('/tasks/me', actor).expect(403);
      await get(`/tasks/${taskId}`, actor).expect(403);
    }
  });

  it('isolates both users for list, detail and total, with safe exact serialization', async () => {
    const a = await get().expect(200);
    expect(a.body).toEqual({
      items: [
        {
          id: String(taskId),
          title: 'Deliver [towels]',
          taskType: 'SERVICE',
          priority: 'NORMAL',
          status: 'ASSIGNED',
          assignedAt: assignedAt.toISOString(),
          sourceType: 'SERVICE_ORDER',
          sourceId: String(sourceId),
          sourceSummary: null,
        },
      ],
      total: 1,
      page: 1,
      limit: 20,
    });
    const b = await get('/tasks/me', 'bob').expect(200);
    expect(b.body.items.map((item: any) => item.id)).toEqual([String(otherId)]);
    expect(b.body.total).toBe(1);
    expect((await get(`/tasks/${taskId}`).expect(200)).body).toEqual(
      a.body.items[0],
    );
    await get(`/tasks/${otherId}`).expect(404);
    await get(`/tasks/${taskId}`, 'bob').expect(404);
    expect(sourceAccess).not.toHaveBeenCalled();
  });

  it('returns identical 404 for foreign, absent and malformed IDs', async () => {
    const bodies = [];
    for (const id of [
      String(otherId),
      String(new Types.ObjectId()),
      'bad-id',
    ]) {
      bodies.push((await get(`/tasks/${id}`).expect(404)).body);
    }
    expect(bodies[0]).toEqual(bodies[1]);
    expect(bodies[1]).toEqual(bodies[2]);
  });

  it('combines filters, escapes regex, bounds pagination and uses stable ordering', async () => {
    const res = await get()
      .query({
        status: 'ASSIGNED',
        taskType: 'SERVICE',
        keyword: '[towels]',
        page: '2',
        limit: '1',
      })
      .expect(200);
    expect(res.body).toMatchObject({ total: 1, page: 2, limit: 1 });
    const filter = find.mock.calls[0][0];
    expect(filter).toEqual({
      assignedTo: alice,
      status: 'ASSIGNED',
      taskType: 'SERVICE',
      title: { $regex: '\\[towels\\]', $options: 'i' },
    });
    expect(countDocuments).toHaveBeenCalledWith(filter);
    const chain = find.mock.results[0].value;
    expect(chain.select).toHaveBeenCalledWith(
      expect.objectContaining({ _id: 1, sourceId: 1 }),
    );
    expect(chain.sort).toHaveBeenCalledWith({ assignedAt: -1, _id: -1 });
    expect(chain.skip).toHaveBeenCalledWith(1);
    expect(chain.limit).toHaveBeenCalledWith(1);
    expect(
      (await get().query({ keyword: '.*' }).expect(200)).body,
    ).toMatchObject({ items: [], total: 0 });
    expect(
      (await get().query({ status: 'COMPLETED' }).expect(200)).body.items,
    ).toEqual([]);
  });

  it.each([
    { userId: String(bob) },
    { assignedTo: String(bob) },
    { sourceType: 'ISSUE' },
    { status: 'PENDING' },
    { status: ['ASSIGNED', 'COMPLETED'] },
    { taskType: { $ne: '' } },
    { taskType: '' },
    { taskType: 'x'.repeat(101) },
    { keyword: ['a', 'b'] },
    { keyword: 'x'.repeat(101) },
    { keyword: ' ' },
    { page: '0' },
    { page: '10001' },
    { page: '1.5' },
    { page: '1e2' },
    { page: '' },
    { page: ['1', '2'] },
    { limit: '0' },
    { limit: '101' },
    { limit: '-1' },
    { limit: 'NaN' },
  ])(
    'rejects invalid or unauthorized query %j before querying tasks',
    async (query) => {
      await get().query(query).expect(400);
      expect(find).not.toHaveBeenCalled();
      expect(countDocuments).not.toHaveBeenCalled();
    },
  );

  it('serializes optional completion fields without exposing arbitrary document fields', async () => {
    const chain = queryChain([
      {
        ...records[0],
        dueAt: assignedAt,
        completedAt: assignedAt,
        workResult: 'Done',
      } as (typeof records)[number],
    ]);
    find.mockReturnValueOnce(chain);
    const res = await get().expect(200);
    expect(res.body.items[0]).toMatchObject({
      dueAt: assignedAt.toISOString(),
      completedAt: assignedAt.toISOString(),
      workResult: 'Done',
    });
    expect(res.body.items[0]).not.toHaveProperty('secret');
    expect(res.body.items[0]).not.toHaveProperty('assignedTo');
    expect(sourceAccess).not.toHaveBeenCalled();
  });

  const patch = (body: unknown, actor = 'alice', id = String(taskId)) =>
    request(app.getHttpServer())
      .patch(`/tasks/${id}/progress`)
      .auth(actor, { type: 'bearer' })
      .send(body as object);

  it('UC38 enforces real authentication, roles and private ownership', async () => {
    await request(app.getHttpServer())
      .patch(`/tasks/${taskId}/progress`)
      .send({ status: 'IN_PROGRESS' })
      .expect(401);
    await patch({ status: 'IN_PROGRESS' }, 'invalid').expect(401);
    for (const actor of ['denied', 'manager'])
      await patch({ status: 'IN_PROGRESS' }, actor).expect(403);
    for (const id of [String(otherId), String(new Types.ObjectId()), 'bad'])
      await patch({ status: 'IN_PROGRESS' }, 'alice', id).expect(404);
    expect(findOneAndUpdate).not.toHaveBeenCalled();
  });

  it.each([
    {},
    { status: 'ASSIGNED' },
    { status: 'PENDING' },
    { status: ['IN_PROGRESS'] },
    { status: 'COMPLETED' },
    { status: 'COMPLETED', workResult: ' ' },
    { status: 'COMPLETED', workResult: null },
    { status: 'COMPLETED', workResult: 42 },
    { status: 'COMPLETED', workResult: 'x'.repeat(2001) },
    { status: 'IN_PROGRESS', workResult: 'premature' },
    ...[
      'expectedStatus',
      'assignedTo',
      'assigneeId',
      'source',
      'sourceType',
      'sourceId',
      'completedAt',
      'actorUserId',
    ].map((key) => ({ status: 'IN_PROGRESS', [key]: 'injected' })),
  ])('UC38 rejects invalid progress %j', async (body) => {
    await patch(body).expect(400);
    expect(findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('UC38 starts and completes with safe serialization and immutable references', async () => {
    await patch({ status: 'COMPLETED', workResult: 'skip' }).expect(409);
    const start = await patch({ status: 'IN_PROGRESS' }).expect(200);
    expect(start.body).toMatchObject({
      id: String(taskId),
      status: 'IN_PROGRESS',
      sourceId: String(sourceId),
      sourceSummary: null,
    });
    expect(start.body).not.toHaveProperty('completedAt');
    expect(start.body).not.toHaveProperty('assignedTo');
    expect(start.body).not.toHaveProperty('secret');
    await patch({ status: 'IN_PROGRESS' }).expect(409);
    const complete = await patch({
      status: 'COMPLETED',
      workResult: ' Resolved ',
    }).expect(200);
    expect(complete.body.workResult).toBe('Resolved');
    expect(complete.body.completedAt).toMatch(/Z$/);
    expect(records[0].assignedTo).toEqual(alice);
    expect(records[0].sourceId).toEqual(sourceId);
    await patch({ status: 'COMPLETED', workResult: 'replay' }).expect(409);
    await patch({ status: 'IN_PROGRESS' }).expect(409);
    expect(sourceAccess).not.toHaveBeenCalled();
  });

  it('UC38 permits an active custom executor only on own tasks', async () => {
    transitionRole = 'CUSTOM_EXECUTOR';
    await patch({ status: 'IN_PROGRESS' }, 'custom').expect(200);
    await patch({ status: 'IN_PROGRESS' }, 'custom', String(otherId)).expect(
      404,
    );
    expect(roleExists).toHaveBeenCalledWith({
      code: 'CUSTOM_EXECUTOR',
      isActive: true,
      permissions: { $all: ['task:execute'] },
    });
  });

  it('UC38 allows only one concurrent start and completion', async () => {
    for (const body of [
      { status: 'IN_PROGRESS' },
      { status: 'COMPLETED', workResult: 'x'.repeat(2000) },
    ]) {
      const responses = await Promise.all([patch(body), patch(body)]);
      expect(responses.map((res) => res.status).sort()).toEqual([200, 409]);
    }
  });

  it('does not expose progress mutation routes', async () => {
    await request(app.getHttpServer())
      .patch(`/tasks/${taskId}`)
      .auth('alice', { type: 'bearer' })
      .send({ status: 'COMPLETED' })
      .expect(404);
  });
});
