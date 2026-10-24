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
import { Issue } from '../src/modules/issues/schemas/issue.schema.js';
import { User } from '../src/modules/users/schemas/user.schema.js';
import { Task } from '../src/modules/tasks/schemas/task.schema.js';
import { TasksService } from '../src/modules/tasks/tasks.service.js';
import { assertTestDatabase } from './test-database.js';

describe('Issue review and assignment Mongo protocol (e2e)', () => {
  let app: INestApplication;
  let issues: Model<Issue>;
  let tasks: Model<Task>;
  let users: Model<User>;
  let bookings: Model<Booking>;
  let taskService: TasksService;
  const bookingId = new Types.ObjectId();
  const customerId = new Types.ObjectId();
  const receptionistId = new Types.ObjectId();
  const serviceId = new Types.ObjectId();
  const operationsId = new Types.ObjectId();
  const inactiveId = new Types.ObjectId();
  const created: string[] = [];
  const headers = (role = 'RECEPTIONIST', id = receptionistId) => ({
    'x-dev-role': role,
    'x-dev-user-id': String(id),
  });
  const reviewBody = {
    handlingCategory: 'SERVICE',
    priority: 'URGENT',
    needsStaffAction: true,
    notes: 'Internal review note',
  };
  const assignment = {
    assigneeId: String(serviceId),
    dueAt: '2030-01-01T12:00:00.000Z',
  };
  const review = (
    id: string,
    body: object = reviewBody,
    role = 'RECEPTIONIST',
  ) =>
    request(app.getHttpServer())
      .patch(`/api/v1/issues/${id}/review`)
      .set(headers(role))
      .send(body);
  const assign = (
    id: string,
    body: object = assignment,
    role = 'RECEPTIONIST',
  ) =>
    request(app.getHttpServer())
      .post(`/api/v1/issues/${id}/assignment`)
      .set(headers(role))
      .send(body);
  const get = (id: string, role = 'RECEPTIONIST', actor = receptionistId) =>
    request(app.getHttpServer())
      .get(`/api/v1/issues/${id}`)
      .set(headers(role, actor));
  const close = (
    id: string,
    body: object = { conclusion: ' Confirmed resolved ' },
    role = 'RECEPTIONIST',
  ) =>
    request(app.getHttpServer())
      .post(`/api/v1/issues/${id}/close`)
      .set(headers(role))
      .send(body);
  const report = async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/issues')
      .set(headers('CUSTOMER', customerId))
      .send({
        title: 'Broken lamp',
        category: 'Lighting',
        description: 'No light',
        bookingId: String(bookingId),
      })
      .expect(201);
    created.push(response.body.id);
    return response.body.id as string;
  };

  beforeAll(async () => {
    assertTestDatabase(process.env.MONGODB_URI);
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    await app.init();
    issues = app.get(getModelToken(Issue.name));
    tasks = app.get(getModelToken(Task.name));
    users = app.get(getModelToken(User.name));
    bookings = app.get(getModelToken(Booking.name));
    taskService = app.get(TasksService);
    await users.create([
      {
        _id: serviceId,
        fullName: 'Service Staff',
        email: `${serviceId}@example.test`,
        role: 'SERVICE_STAFF',
        isActive: true,
      },
      {
        _id: operationsId,
        fullName: 'Operations Staff',
        email: `${operationsId}@example.test`,
        role: 'OPERATIONS_STAFF',
        isActive: true,
      },
      {
        _id: inactiveId,
        fullName: 'Inactive Staff',
        email: `${inactiveId}@example.test`,
        role: 'SERVICE_STAFF',
        isActive: false,
      },
    ]);
    await bookings.create({
      _id: bookingId,
      code: `ISS-HANDLING-${bookingId}`,
      customer: customerId,
      rooms: [new Types.ObjectId()],
      guestName: 'Issue Customer',
      guestEmail: 'customer@example.test',
      guestPhone: '0900000000',
      checkIn: new Date('2020-01-01'),
      checkOut: new Date('2020-01-02'),
      guests: 1,
      status: BookingStatus.CheckedOut,
      roomTotal: 100000,
      depositAmount: 100000,
    });
  });

  afterEach(() => vi.restoreAllMocks());
  afterAll(async () => {
    if (!app) return;
    await tasks.deleteMany({ sourceId: { $in: created } });
    await issues.deleteMany({ _id: { $in: created } });
    await users.deleteMany({
      _id: { $in: [serviceId, operationsId, inactiveId] },
    });
    await bookings.deleteOne({ _id: bookingId });
    await app.close();
  });

  it.each(['RECEPTIONIST', 'MANAGER'])(
    'closes valid concluded work as %s, preserves history and hides staff audit from customer',
    async (role) => {
      const id = await report();
      await close(id).expect(409);
      await review(id, { ...reviewBody, needsStaffAction: false }).expect(200);
      const before = await issues.findById(id).lean();
      const result = await close(
        id,
        { conclusion: ' Private closure explanation ' },
        role,
      ).expect(201);
      expect(result.body).toMatchObject({
        status: 'CLOSED',
        closedBy: String(receptionistId),
        closureConclusion: 'Private closure explanation',
        reviewNotes: reviewBody.notes,
      });
      expect(result.body.closedAt).toBeDefined();
      const saved = await issues.findById(id).lean();
      expect(saved?.reviewedAt).toEqual(before?.reviewedAt);
      expect(saved?.concludedAt).toEqual(before?.concludedAt);
      expect(saved?.reporter).toEqual(before?.reporter);
      await close(id, { conclusion: 'Overwrite' }).expect(409);
      expect((await issues.findById(id).lean())?.closedAt).toEqual(
        saved?.closedAt,
      );
      const customer = await get(id, 'CUSTOMER', customerId).expect(200);
      expect(customer.body.status).toBe('CLOSED');
      expect(customer.body.closedAt).toBe(result.body.closedAt);
      for (const key of ['closedBy', 'closureConclusion', 'reviewNotes'])
        expect(customer.body).not.toHaveProperty(key);
      const page = await request(app.getHttpServer())
        .get('/api/v1/issues?status=CLOSED')
        .set(headers('CUSTOMER', customerId))
        .expect(200);
      const item = page.body.items.find((entry: any) => entry.id === id);
      expect(item).toBeDefined();
      expect(item).not.toHaveProperty('closureConclusion');
      expect(item).not.toHaveProperty('closedBy');
      expect(await tasks.countDocuments({ sourceId: id })).toBe(0);
    },
  );

  it('requires completion through task core, then closes only once concurrently without task changes', async () => {
    const id = await report();
    await review(id).expect(200);
    await close(id).expect(409);
    const assigned = await assign(id).expect(201);
    const taskId = assigned.body.linkedTasks[0].id;
    await close(id).expect(409);
    await taskService.transitionAssignedTask(
      taskId,
      String(serviceId),
      'ASSIGNED' as any,
      'IN_PROGRESS' as any,
    );
    await close(id).expect(409);
    await taskService.transitionAssignedTask(
      taskId,
      String(serviceId),
      'IN_PROGRESS' as any,
      'COMPLETED' as any,
      'Repaired lamp',
    );
    const before = await tasks.findById(taskId).lean();
    expect((await get(id).expect(200)).body.status).toBe('ASSIGNED');
    const results = await Promise.all(
      Array.from({ length: 6 }, () => close(id)),
    );
    expect(results.map((response) => response.status).sort()).toEqual([
      201, 409, 409, 409, 409, 409,
    ]);
    expect(await tasks.findById(taskId).lean()).toEqual(before);
    expect((await get(id).expect(200)).body.linkedTasks[0].id).toBe(taskId);
  });

  it('rejects close when review snapshot changes during persisted work lookup', async () => {
    const id = await report();
    await review(id).expect(200);
    const assigned = await assign(id).expect(201);
    const taskId = assigned.body.linkedTasks[0].id;
    await taskService.transitionAssignedTask(
      taskId,
      String(serviceId),
      'ASSIGNED' as any,
      'IN_PROGRESS' as any,
    );
    await taskService.transitionAssignedTask(
      taskId,
      String(serviceId),
      'IN_PROGRESS' as any,
      'COMPLETED' as any,
      'Repaired',
    );
    const original = taskService.findIssueResolutionWork.bind(taskService);
    vi.spyOn(taskService, 'findIssueResolutionWork').mockImplementationOnce(
      async (sourceId) => {
        const task = await original(sourceId);
        await issues.updateOne(
          { _id: id },
          { $set: { reviewNotes: 'Concurrent review correction' } },
        );
        return task;
      },
    );
    await close(id).expect(409);
    expect((await issues.findById(id).lean())?.closedAt).toBeUndefined();
  });

  it('denies unauthorized close and rejects client-controlled fields', async () => {
    const id = await report();
    for (const role of ['CUSTOMER', 'SERVICE_STAFF', 'OPERATIONS_STAFF'])
      await close(id, { conclusion: 'Done' }, role).expect(403);
    await close(id, { conclusion: 'Done' }, 'CUSTOM_ROLE').expect(400);
    await request(app.getHttpServer())
      .post(`/api/v1/issues/${id}/close`)
      .send({ conclusion: 'Done' })
      .expect(401);
    for (const body of [
      {},
      { conclusion: null },
      { conclusion: '' },
      { conclusion: ' ' },
      { conclusion: 1 },
      { conclusion: 'x'.repeat(2001) },
      { conclusion: 'Done', status: 'COMPLETED' },
      { conclusion: 'Done', closedAt: new Date().toISOString() },
      { conclusion: 'Done', closedBy: String(receptionistId) },
      { conclusion: 'Done', needsStaffAction: false },
    ])
      await close(id, body).expect(400);
    await close('bad').expect(404);
    await close(String(new Types.ObjectId())).expect(404);
    expect((await issues.findById(id).lean())?.status).toBe('PENDING_REVIEW');
  });

  it('atomically accepts one racing review and never rereviews or assigns a conclusion', async () => {
    const id = await report();
    const responses = await Promise.all([review(id), review(id)]);
    expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
    expect((await issues.findById(id).lean())?.category).toBe('Lighting');
    await review(id).expect(409);
    const concluded = await report();
    const result = await review(concluded, {
      ...reviewBody,
      needsStaffAction: false,
    }).expect(200);
    expect(result.body).toMatchObject({
      status: 'CONCLUDED',
      needsStaffAction: false,
    });
    expect(result.body.concludedAt).toBeDefined();
    expect(result.body.closedAt).toBeUndefined();
    await assign(concluded).expect(409);
    expect(await tasks.countDocuments({ sourceId: concluded })).toBe(0);
  });

  it('filters assignees by active handling role without contact data and rejects inappropriate staff', async () => {
    const id = await report();
    await assign(id).expect(409);
    await review(id).expect(200);
    const response = await request(app.getHttpServer())
      .get(`/api/v1/issues/${id}/assignees`)
      .set(headers())
      .expect(200);
    expect(response.body.items).toContainEqual({
      id: String(serviceId),
      displayName: 'Service Staff',
      role: 'SERVICE_STAFF',
    });
    expect(
      response.body.items.every(
        (staff: any) =>
          staff.role === 'SERVICE_STAFF' &&
          Object.keys(staff).sort().join(',') === 'displayName,id,role',
      ),
    ).toBe(true);
    expect(
      response.body.items.some((staff: any) => staff.id === String(inactiveId)),
    ).toBe(false);
    for (const staff of [operationsId, inactiveId, new Types.ObjectId()])
      await assign(id, { assigneeId: String(staff) }).expect(400);
    expect((await issues.findById(id).lean())?.status).toBe('REVIEWED');
    const operations = await report();
    await review(operations, {
      ...reviewBody,
      handlingCategory: 'OPERATIONS',
    }).expect(200);
    await assign(operations).expect(400);
    await assign(operations, { assigneeId: String(operationsId) }).expect(201);
  });

  it('racing assignments create exactly one task with stable source and audit', async () => {
    const id = await report();
    await review(id).expect(200);
    const responses = await Promise.all(
      Array.from({ length: 6 }, () => assign(id)),
    );
    expect(responses.filter((r) => r.status === 201)).toHaveLength(1);
    expect(responses.every((r) => [201, 409].includes(r.status))).toBe(true);
    expect(
      await tasks.countDocuments({
        sourceId: new Types.ObjectId(id),
        sourceType: 'ISSUE',
        taskType: 'ISSUE_RESOLUTION',
      }),
    ).toBe(1);
    const result = await get(id).expect(200);
    expect(result.body).toMatchObject({
      status: 'ASSIGNED',
      reviewedBy: String(receptionistId),
      assignmentRequestedBy: String(receptionistId),
      assigneeId: String(serviceId),
      dueAt: assignment.dueAt,
      linkedTasksAvailable: true,
    });
    expect(result.body.linkedTasks[0]).toMatchObject({
      taskType: 'ISSUE_RESOLUTION',
      priority: 'URGENT',
      status: 'ASSIGNED',
      assigneeId: String(serviceId),
    });
    await assign(id).expect(409);
    await review(id).expect(409);
  });

  it('recovers after task commit then issue write failure, even after task completion', async () => {
    const id = await report();
    await review(id).expect(200);
    const original = issues.findOneAndUpdate.bind(issues);
    const spy = vi.spyOn(issues, 'findOneAndUpdate').mockImplementation(((
      filter: any,
      update: any,
      options: any,
    ) => {
      if (update.$set?.status === 'ASSIGNED')
        throw new Error('Injected issue write failure');
      return original(filter, update, options);
    }) as any);
    await assign(id).expect(500);
    spy.mockRestore();
    const pending = await issues.findById(id).lean();
    expect(pending?.status).toBe('ASSIGNING');
    const task = await tasks
      .findOne({ sourceId: new Types.ObjectId(id) })
      .lean();
    expect(task).not.toBeNull();
    await taskService.transitionAssignedTask(
      String(task!._id),
      String(serviceId),
      'ASSIGNED' as any,
      'IN_PROGRESS' as any,
    );
    await taskService.transitionAssignedTask(
      String(task!._id),
      String(serviceId),
      'IN_PROGRESS' as any,
      'COMPLETED' as any,
      'Internal work result',
    );
    await close(id).expect(409);
    const createSpy = vi.spyOn(taskService, 'create');
    await assign(id, { ...assignment, dueAt: '2031-01-01T00:00:00Z' }).expect(
      409,
    );
    const recovered = await assign(id).expect(201);
    expect(createSpy).not.toHaveBeenCalled();
    expect(recovered.body.status).toBe('ASSIGNED');
    expect(recovered.body.closedAt).toBeUndefined();
    expect(recovered.body.linkedTasks[0]).toMatchObject({
      id: String(task!._id),
      status: 'COMPLETED',
    });
    expect(recovered.body.linkedTasks[0]).not.toHaveProperty('workResult');
    expect(
      await tasks.countDocuments({ sourceId: new Types.ObjectId(id) }),
    ).toBe(1);
    const customer = await get(id, 'CUSTOMER', customerId).expect(200);
    for (const key of [
      'reviewNotes',
      'reviewedBy',
      'assignmentRequestedBy',
      'assigneeId',
      'dueAt',
    ])
      expect(customer.body).not.toHaveProperty(key);
    expect(customer.body.linkedTasks).toEqual([]);
    expect(customer.body.linkedTasksAvailable).toBe(false);
    const page = await request(app.getHttpServer())
      .get('/api/v1/issues?status=ASSIGNED&priority=URGENT')
      .set(headers('CUSTOMER', customerId))
      .expect(200);
    expect(
      page.body.items.find((item: any) => item.id === id),
    ).not.toHaveProperty('reviewNotes');
  });

  it('prevents a delayed writer from recreating completed work after a concurrent retry', async () => {
    const id = await report();
    await review(id).expect(200);
    let release!: () => void;
    let entered!: () => void;
    const paused = new Promise<void>((resolve) => {
      release = resolve;
    });
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const original = taskService.create.bind(taskService);
    vi.spyOn(taskService, 'create').mockImplementationOnce(
      async (dto, identity) => {
        entered();
        await paused;
        return original(dto, identity);
      },
    );
    const first = assign(id).then((response) => response);
    await started;
    try {
      const retry = await assign(id).expect(201);
      const taskId = retry.body.linkedTasks[0].id;
      await taskService.transitionAssignedTask(
        taskId,
        String(serviceId),
        'ASSIGNED' as any,
        'IN_PROGRESS' as any,
      );
      await taskService.transitionAssignedTask(
        taskId,
        String(serviceId),
        'IN_PROGRESS' as any,
        'COMPLETED' as any,
        'Completed during paused writer',
      );
    } finally {
      release();
    }
    expect((await first).status).toBe(409);
    expect(
      await tasks.countDocuments({ sourceId: new Types.ObjectId(id) }),
    ).toBe(1);
    expect((await get(id).expect(200)).body.linkedTasks[0].status).toBe(
      'COMPLETED',
    );
  });

  it('keeps intent after task failure and recovers with the same deterministic identity', async () => {
    const id = await report();
    await review(id).expect(200);
    vi.spyOn(taskService, 'create').mockRejectedValueOnce(
      new Error('Injected task failure'),
    );
    await assign(id).expect(500);
    const pending = await issues.findById(id).lean();
    expect(pending?.status).toBe('ASSIGNING');
    expect(pending?.linkedTask).toBeUndefined();
    await assign(id).expect(201);
    expect(
      String(
        (await tasks.findOne({ sourceId: new Types.ObjectId(id) }).lean())?._id,
      ),
    ).toBe(String(pending?.assignmentTaskId));
  });

  it.each(['CUSTOMER', 'MANAGER', 'SERVICE_STAFF', 'OPERATIONS_STAFF'])(
    'denies review, assignment and assignees for %s',
    async (role) => {
      const id = await report();
      await review(id, reviewBody, role).expect(403);
      await assign(id, assignment, role).expect(403);
      await request(app.getHttpServer())
        .get(`/api/v1/issues/${id}/assignees`)
        .set(headers(role))
        .expect(403);
    },
  );

  it('rejects unauthenticated, missing and invalid payloads without changing issue', async () => {
    const id = await report();
    await request(app.getHttpServer())
      .patch(`/api/v1/issues/${id}/review`)
      .send(reviewBody)
      .expect(401);
    for (const body of [
      { ...reviewBody, handlingCategory: 'Lighting' },
      { ...reviewBody, priority: 'CRITICAL' },
      { ...reviewBody, needsStaffAction: 'true' },
      { ...reviewBody, notes: null },
      { ...reviewBody, status: 'CLOSED' },
    ])
      await review(id, body).expect(400);
    await review(String(new Types.ObjectId())).expect(404);
    await review('bad').expect(404);
    await review(id).expect(200);
    for (const body of [
      { assigneeId: 'bad' },
      { ...assignment, dueAt: null },
      { ...assignment, dueAt: 'bad' },
      { ...assignment, dueAt: '2030-02-30T00:00:00Z' },
      { ...assignment, priority: 'LOW' },
    ])
      await assign(id, body).expect(400);
    expect((await issues.findById(id).lean())?.status).toBe('REVIEWED');
  });
});
