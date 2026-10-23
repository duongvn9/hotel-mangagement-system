import { VersioningType, type INestApplication } from '@nestjs/common';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { Types, type Model, type Connection } from 'mongoose';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { ID_TOKEN_VERIFIER } from '../src/modules/auth/firebase.module.js';
import { Role } from '../src/modules/roles/schemas/role.schema.js';
import { Task } from '../src/modules/tasks/schemas/task.schema.js';
import {
  TaskSourceType,
  TaskStatus,
} from '../src/modules/tasks/task-contract.js';
import { User } from '../src/modules/users/schemas/user.schema.js';

describe('UC37 tasks (Mongo e2e)', () => {
  let app: INestApplication;
  let tasks: Model<Task>;
  let users: Model<User>;
  let roles: Model<Role>;
  let connection: Connection;
  const issueId = new Types.ObjectId();
  const userIds = [
    new Types.ObjectId(),
    new Types.ObjectId(),
    new Types.ObjectId(),
  ];
  const taskIds = [
    new Types.ObjectId(),
    new Types.ObjectId(),
    new Types.ObjectId(),
  ];
  const roleId = new Types.ObjectId();
  const customRole = `TASK_EXECUTOR_${roleId}`.toUpperCase();
  const tokenPrefix = `uc37-${roleId}`;
  const get = (path = '/api/v1/tasks/me', actor = 0) =>
    request(app.getHttpServer())
      .get(path)
      .auth(`${tokenPrefix}-${actor}`, { type: 'bearer' });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ID_TOKEN_VERIFIER)
      .useValue({
        verifyIdToken: async (token: string) => ({
          uid: token,
          email_verified: true,
        }),
      })
      .compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    await app.init();
    tasks = app.get(getModelToken(Task.name));
    users = app.get(getModelToken(User.name));
    roles = app.get(getModelToken(Role.name));
    connection = app.get(getConnectionToken());
    await connection
      .collection('issues')
      .insertOne({ _id: issueId, status: 'OPEN', marker: tokenPrefix });
    await roles.create({
      _id: roleId,
      code: customRole,
      name: 'UC37 test executor',
      permissions: ['task:execute'],
      isActive: true,
    });
    await users.create(
      userIds.map((_id, i) => ({
        _id,
        email: `${tokenPrefix}-${i}@test.invalid`,
        fullName: 'UC37 test',
        firebaseUid: `${tokenPrefix}-${i}`,
        emailVerified: true,
        isActive: true,
        role: ['SERVICE_STAFF', 'OPERATIONS_STAFF', customRole][i],
      })),
    );
    await tasks.create(
      taskIds.map((_id, i) => ({
        _id,
        title: `UC37 [${roleId}]`,
        assignedTo: userIds[i],
        assignedAt: new Date('2026-10-20T12:00:00Z'),
        taskType: 'SERVICE',
        priority: 'NORMAL',
        status: TaskStatus.Assigned,
        sourceType:
          i === 0
            ? TaskSourceType.Issue
            : i === 1
              ? TaskSourceType.Maintenance
              : TaskSourceType.ServiceOrder,
        sourceId: i === 0 ? issueId : new Types.ObjectId(),
      })),
    );
  });

  afterAll(async () => {
    try {
      if (tasks) await tasks.deleteMany({ _id: { $in: taskIds } });
      if (users) await users.deleteMany({ _id: { $in: userIds } });
      if (roles) await roles.deleteMany({ _id: roleId });
      if (connection)
        await connection.collection('issues').deleteOne({ _id: issueId });
    } finally {
      await app?.close();
    }
  });

  it('isolates both staff and a custom permission role, preserving missing-source references', async () => {
    for (let i = 0; i < 3; i++) {
      const res = await get('/api/v1/tasks/me', i).expect(200);
      expect(res.body.total).toBe(1);
      expect(res.body.items.map((item: { id: string }) => item.id)).toEqual([
        String(taskIds[i]),
      ]);
      const detail = await get(`/api/v1/tasks/${taskIds[i]}`, i).expect(200);
      expect(detail.body).toEqual(res.body.items[0]);
      expect(detail.body.sourceId).toMatch(/^[a-f0-9]{24}$/);
      expect(detail.body.sourceSummary).toBeNull();
      expect(detail.body).not.toHaveProperty('assignedTo');
      await get(`/api/v1/tasks/${taskIds[(i + 1) % 3]}`, i).expect(404);
    }
  });

  it('filters and paginates without allowing ownership override', async () => {
    const res = await get()
      .query({
        keyword: `[${roleId}]`,
        status: 'ASSIGNED',
        taskType: 'SERVICE',
        page: 1,
        limit: 1,
      })
      .expect(200);
    expect(res.body).toMatchObject({ total: 1, page: 1, limit: 1 });
    expect(res.body.items).toHaveLength(1);
    expect(
      (await get().query({ page: 2, limit: 1 }).expect(200)).body.items,
    ).toEqual([]);
    expect(
      (await get().query({ keyword: '.*' }).expect(200)).body.items,
    ).toEqual([]);
    expect(
      (await get().query({ status: 'COMPLETED' }).expect(200)).body,
    ).toMatchObject({ items: [], total: 0 });
    for (const query of [
      { userId: String(userIds[1]) },
      { limit: 101 },
      { status: 'INVALID' },
    ])
      await get().query(query).expect(400);
  });

  const patch = (body: object, actor = 0, id = String(taskIds[actor])) =>
    request(app.getHttpServer())
      .patch(`/api/v1/tasks/${id}/progress`)
      .auth(`${tokenPrefix}-${actor}`, { type: 'bearer' })
      .send(body);

  it('UC38 rejects unauthorized, foreign and invalid progress requests', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/tasks/${taskIds[0]}/progress`)
      .send({ status: 'IN_PROGRESS' })
      .expect(401);
    await request(app.getHttpServer())
      .patch(`/api/v1/tasks/${taskIds[0]}/progress`)
      .set({ 'x-dev-role': 'MANAGER', 'x-dev-user-id': String(userIds[0]) })
      .send({ status: 'IN_PROGRESS' })
      .expect(403);
    for (const id of [String(taskIds[1]), String(new Types.ObjectId()), 'bad'])
      await patch({ status: 'IN_PROGRESS' }, 0, id).expect(404);
    for (const body of [
      { status: 'ASSIGNED' },
      { status: 'INVALID' },
      { status: 'COMPLETED' },
      { status: 'COMPLETED', workResult: ' ' },
      { status: 'COMPLETED', workResult: null },
      { status: 'COMPLETED', workResult: 'x'.repeat(2001) },
      { status: 'IN_PROGRESS', workResult: 'premature' },
      ...[
        'expectedStatus',
        'assigneeId',
        'assignedTo',
        'sourceId',
        'sourceType',
        'completedAt',
      ].map((key) => ({ status: 'IN_PROGRESS', [key]: 'injected' })),
    ])
      await patch(body).expect(400);
    await patch({ status: 'COMPLETED', workResult: 'skip' }).expect(409);
  });

  it('UC38 real Mongo CAS permits only one start/completion, including custom own tasks; never closes source issue', async () => {
    const issueBefore = await connection
      .collection('issues')
      .findOne({ _id: issueId });
    for (let actor = 0; actor < 3; actor++) {
      const before = await tasks.findById(taskIds[actor]).lean();
      for (const body of [
        { status: 'IN_PROGRESS' },
        { status: 'COMPLETED', workResult: ` ${'x'.repeat(2000)} ` },
      ]) {
        const responses = await Promise.all([
          patch(body, actor),
          patch(body, actor),
        ]);
        expect(responses.map((res) => res.status).sort()).toEqual([200, 409]);
        const success = responses.find((res) => res.status === 200)!;
        expect(success.body).toEqual(
          (await get(`/api/v1/tasks/${taskIds[actor]}`, actor).expect(200))
            .body,
        );
        expect(success.body).not.toHaveProperty('assignedTo');
        if (body.status === 'IN_PROGRESS')
          expect(success.body).not.toHaveProperty('completedAt');
        else {
          expect(success.body.workResult).toBe('x'.repeat(2000));
          expect(success.body.completedAt).toMatch(/Z$/);
        }
      }
      await patch({ status: 'COMPLETED', workResult: 'replay' }, actor).expect(
        409,
      );
      await patch({ status: 'IN_PROGRESS' }, actor).expect(409);
      const after = await tasks.findById(taskIds[actor]).lean();
      expect(after).toMatchObject({
        assignedTo: before!.assignedTo,
        sourceId: before!.sourceId,
        sourceType: before!.sourceType,
        assignedAt: before!.assignedAt,
      });
    }
    expect(
      await connection.collection('issues').findOne({ _id: issueId }),
    ).toEqual(issueBefore);
  });

  it('enforces 401/403 and returns 404 for missing tasks', async () => {
    for (const path of ['/api/v1/tasks/me', `/api/v1/tasks/${taskIds[0]}`]) {
      await request(app.getHttpServer()).get(path).expect(401);
      await request(app.getHttpServer())
        .get(path)
        .set({ 'x-dev-role': 'CUSTOMER', 'x-dev-user-id': String(userIds[0]) })
        .expect(403);
    }
    await get(`/api/v1/tasks/${new Types.ObjectId()}`).expect(404);
    await get('/api/v1/tasks/not-an-id').expect(404);
  });
});
