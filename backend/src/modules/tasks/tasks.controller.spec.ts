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
  const findOne = vi.fn((filter: Record<string, any>) => ({
    select: vi.fn(() => ({
      lean: async () => records.find((row) => matches(row, filter)) ?? null,
    })),
  }));
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
  const users = {
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
          useValue: { find, findOne, countDocuments },
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

  it('does not expose progress mutation routes', async () => {
    await request(app.getHttpServer())
      .patch(`/tasks/${taskId}`)
      .auth('alice', { type: 'bearer' })
      .send({ status: 'COMPLETED' })
      .expect(404);
  });
});
