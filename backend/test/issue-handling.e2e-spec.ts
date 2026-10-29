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
  const replacementId = new Types.ObjectId();
  const alternateId = new Types.ObjectId();
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
      ...[replacementId, alternateId].map((_id) => ({
        _id,
        fullName: 'Replacement Staff',
        email: `${_id}@example.test`,
        role: 'SERVICE_STAFF',
        isActive: true,
      })),
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
      adultCount: 1,
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
      _id: {
        $in: [serviceId, replacementId, alternateId, operationsId, inactiveId],
      },
    });
    await bookings.deleteOne({ _id: bookingId });
    await app.close();
  });

  const unable = (
    taskId: string,
    body: object = { reason: 'Cannot resolve with available equipment' },
    actor = serviceId,
  ) =>
    request(app.getHttpServer())
      .patch(`/api/v1/tasks/${taskId}/unable-to-resolve`)
      .set(headers('SERVICE_STAFF', actor))
      .send(body);
  const resume = (id: string, body: object) =>
    request(app.getHttpServer())
      .post(`/api/v1/issues/${id}/continue`)
      .set(headers())
      .send(body);
  const reassign = (id: string, body: object, actor = receptionistId) =>
    request(app.getHttpServer())
      .post(`/api/v1/issues/${id}/reassign`)
      .set(headers('RECEPTIONIST', actor))
      .send(body);
  const activeIssue = async (blocked = true) => {
    const id = await report();
    await review(id).expect(200);
    const result = await assign(id).expect(201);
    const taskId = result.body.linkedTasks[0].id as string;
    if (blocked) await unable(taskId).expect(200);
    return {
      id,
      taskId,
      body: {
        taskId,
        assigneeId: String(replacementId),
        reason: 'Specialist needed',
        requestId: String(new Types.ObjectId()),
      },
    };
  };

  it('reports inability without changing status and preserves report history across Continue', async () => {
    const { id, taskId } = await activeIssue();
    await unable(taskId, { reason: 'Second report' }).expect(200);
    const before = await tasks.findById(taskId).lean();
    expect(before?.status).toBe('ASSIGNED');
    expect(before?.blockerHistory).toHaveLength(2);
    await expect(
      taskService.transitionAssignedTask(
        taskId,
        String(serviceId),
        'ASSIGNED' as any,
        'IN_PROGRESS' as any,
      ),
    ).rejects.toThrow('blocked');
    await resume(id, {
      taskId,
      instructions: 'Use replacement parts',
      dueAt: '2031-01-01T00:00:00Z',
    }).expect(201);
    const after = await tasks.findById(taskId).lean();
    expect(after?.assignedTo).toEqual(before?.assignedTo);
    expect(after?.status).toBe(before?.status);
    expect(after?.blocked).toBe(false);
    expect(
      after?.blockerHistory?.every((entry) => entry.resolution === 'CONTINUED'),
    ).toBe(true);
    expect(after?.continuationHistory).toHaveLength(1);
    const detail = await get(id).expect(200);
    expect(detail.body.dueAt).toBe('2031-01-01T00:00:00.000Z');
    expect(detail.body.linkedTasks[0].dueAt).toBe(detail.body.dueAt);
    const page = await request(app.getHttpServer())
      .get('/api/v1/issues')
      .set(headers())
      .expect(200);
    expect(page.body.items.find((entry: any) => entry.id === id).dueAt).toBe(
      detail.body.dueAt,
    );
    await taskService.transitionAssignedTask(
      taskId,
      String(serviceId),
      'ASSIGNED' as any,
      'IN_PROGRESS' as any,
    );
  });

  it('reassigns blocked work with exact source linkage, history and idempotent replay', async () => {
    const { id, taskId, body } = await activeIssue();
    const result = await reassign(id, body).expect(201);
    const target = result.body.linkedTasks[0].id;
    expect(target).not.toBe(taskId);
    expect(result.body.status).toBe('ASSIGNED');
    expect(result.body.resolutionTasks).toHaveLength(2);
    expect((await tasks.findById(taskId).lean())?.cancellation).toMatchObject({
      reason: body.reason,
      actorId: String(receptionistId),
    });
    expect((await tasks.findById(taskId).lean())?.status).toBe('CANCELLED');
    await reassign(id, body).expect(201);
    expect(
      await tasks.countDocuments({
        sourceId: new Types.ObjectId(id),
        status: { $in: ['ASSIGNED', 'IN_PROGRESS'] },
      }),
    ).toBe(1);
    await close(id).expect(409);
    await unable(taskId).expect(409);
    await taskService.transitionAssignedTask(
      target,
      String(replacementId),
      'ASSIGNED' as any,
      'IN_PROGRESS' as any,
    );
    await taskService.transitionAssignedTask(
      target,
      String(replacementId),
      'IN_PROGRESS' as any,
      'COMPLETED' as any,
      'Repaired by specialist',
    );
    await close(id).expect(201);
  });

  it.each(['cancel', 'create', 'link'])(
    'recovers durable %s failure using another receptionist',
    async (stage) => {
      const { id, body } = await activeIssue();
      let spy: any;
      if (stage === 'cancel')
        spy = vi
          .spyOn(taskService, 'cancelIssueTask')
          .mockRejectedValueOnce(new Error('Injected cancel failure'));
      if (stage === 'create')
        spy = vi
          .spyOn(taskService, 'create')
          .mockRejectedValueOnce(new Error('Injected create failure'));
      if (stage === 'link') {
        const original = issues.findOneAndUpdate.bind(issues);
        spy = vi.spyOn(issues, 'findOneAndUpdate').mockImplementation(((
          filter: any,
          update: any,
          options: any,
        ) => {
          if (update.$set?.linkedTask) throw new Error('Injected link failure');
          return original(filter, update, options);
        }) as any);
      }
      await reassign(id, body).expect(500);
      spy.mockRestore();
      const pending = (await issues.findById(id).lean())?.pendingReassignment;
      expect(pending).toBeDefined();
      await close(id).expect(409);
      await resume(id, { taskId: body.taskId }).expect(409);
      const recoveryActor = new Types.ObjectId();
      const result = await reassign(id, body, recoveryActor).expect(201);
      expect(result.body.linkedTasks[0].id).toBe(pending?.targetTaskId);
      expect(result.body.reassignmentHistory[0].actorId).toBe(
        String(receptionistId),
      );
      expect(result.body.reassignmentHistory[0].recoveryActors).toContain(
        String(recoveryActor),
      );
      expect(
        await tasks.countDocuments({
          sourceId: new Types.ObjectId(id),
          status: { $in: ['ASSIGNED', 'IN_PROGRESS'] },
        }),
      ).toBe(1);
    },
  );

  it('replaces inactive unused target with fenced deterministic ID', async () => {
    const { id, body } = await activeIssue();
    const spy = vi
      .spyOn(taskService, 'create')
      .mockRejectedValueOnce(new Error('Injected create failure'));
    await reassign(id, body).expect(500);
    spy.mockRestore();
    const pending = (await issues.findById(id).lean())!.pendingReassignment!;
    await users.updateOne(
      { _id: replacementId },
      { $set: { isActive: false } },
    );
    try {
      await reassign(id, body).expect(409);
      const result = await reassign(id, {
        ...body,
        assigneeId: String(alternateId),
      }).expect(201);
      expect(result.body.linkedTasks[0].id).not.toBe(pending.targetTaskId);
      expect((await tasks.findById(pending.targetTaskId).lean())?.status).toBe(
        'CANCELLED',
      );
      expect(
        await tasks.countDocuments({
          sourceId: new Types.ObjectId(id),
          status: { $in: ['ASSIGNED', 'IN_PROGRESS'] },
        }),
      ).toBe(1);
    } finally {
      await users.updateOne(
        { _id: replacementId },
        { $set: { isActive: true } },
      );
    }
  });

  it('finalizes already-created inactive target blocked for fresh replacement', async () => {
    const { id, body } = await activeIssue();
    const original = issues.findOneAndUpdate.bind(issues);
    const spy = vi.spyOn(issues, 'findOneAndUpdate').mockImplementation(((
      filter: any,
      update: any,
      options: any,
    ) => {
      if (update.$set?.linkedTask) throw new Error('Injected link failure');
      return original(filter, update, options);
    }) as any);
    await reassign(id, body).expect(500);
    spy.mockRestore();
    await users.updateOne(
      { _id: replacementId },
      { $set: { isActive: false } },
    );
    try {
      const result = await reassign(id, body).expect(201);
      const target = result.body.linkedTasks[0].id;
      expect((await tasks.findById(target).lean())?.blocked).toBe(true);
      await reassign(id, {
        ...body,
        taskId: target,
        assigneeId: String(alternateId),
        requestId: String(new Types.ObjectId()),
      }).expect(201);
    } finally {
      await users.updateOne(
        { _id: replacementId },
        { $set: { isActive: true } },
      );
    }
  });

  it('completion and overdue reassignment race has one safe winner', async () => {
    const { id, taskId, body } = await activeIssue(false);
    await taskService.transitionAssignedTask(
      taskId,
      String(serviceId),
      'ASSIGNED' as any,
      'IN_PROGRESS' as any,
    );
    await tasks.updateOne({ _id: taskId }, { $set: { dueAt: new Date(0) } });
    await Promise.allSettled([
      taskService.transitionAssignedTask(
        taskId,
        String(serviceId),
        'IN_PROGRESS' as any,
        'COMPLETED' as any,
        'Completed before cancellation',
      ),
      reassign(id, body),
    ]);
    const old = await tasks.findById(taskId).lean();
    const snapshot = await issues.findById(id).lean();
    if (old?.status === 'COMPLETED') {
      if (snapshot?.pendingReassignment) await reassign(id, body).expect(409);
      expect(
        await tasks.countDocuments({ sourceId: new Types.ObjectId(id) }),
      ).toBe(1);
      await close(id).expect(201);
    } else {
      expect(old?.status).toBe('CANCELLED');
      if (snapshot?.pendingReassignment) await reassign(id, body).expect(201);
      expect(
        await tasks.countDocuments({
          sourceId: new Types.ObjectId(id),
          status: { $in: ['ASSIGNED', 'IN_PROGRESS'] },
        }),
      ).toBe(1);
      await close(id).expect(409);
    }
  });

  it('racing different intents cannot create multiple active tasks', async () => {
    const { id, body } = await activeIssue();
    const responses = await Promise.all([
      reassign(id, body),
      reassign(id, {
        ...body,
        assigneeId: String(alternateId),
        requestId: String(new Types.ObjectId()),
      }),
    ]);
    expect(
      responses.filter((response) => response.status === 201),
    ).toHaveLength(1);
    expect(
      await tasks.countDocuments({
        sourceId: new Types.ObjectId(id),
        status: { $in: ['ASSIGNED', 'IN_PROGRESS'] },
      }),
    ).toBe(1);
  });

  it('rejects stale, unblocked, same/inactive/wrong-role targets and invalid inputs', async () => {
    const { id, taskId, body } = await activeIssue(false);
    await resume(id, { taskId }).expect(409);
    await reassign(id, body).expect(409);
    await unable(taskId).expect(200);
    for (const assigneeId of [serviceId, inactiveId, operationsId])
      await reassign(id, { ...body, assigneeId: String(assigneeId) }).expect(
        400,
      );
    await reassign(id, {
      ...body,
      taskId: String(new Types.ObjectId()),
    }).expect(409);
    for (const reason of ['', ' ', null, 'x'.repeat(2001)])
      await unable(taskId, { reason }).expect(400);
    await unable(taskId, { reason: 'no', status: 'CANCELLED' }).expect(400);
    await unable(taskId, { reason: 'Not mine' }, replacementId).expect(404);
    await reassign(id, { ...body, extra: true }).expect(400);
  });

  it.each(['CUSTOMER', 'MANAGER', 'SERVICE_STAFF', 'OPERATIONS_STAFF'])(
    'denies resolution decisions to %s',
    async (role) => {
      const { id, body } = await activeIssue();
      for (const endpoint of ['continue', 'reassign'])
        await request(app.getHttpServer())
          .post(`/api/v1/issues/${id}/${endpoint}`)
          .set(headers(role))
          .send(body)
          .expect(403);
    },
  );

  it.each(['ASSIGNING', 'ASSIGNED', 'CLOSED'])(
    'blocks orphan/noncanonical issue task execution for source status %s',
    async (status) => {
      const { id, taskId } = await activeIssue(false);
      await issues.updateOne(
        { _id: id },
        { $set: { status }, $unset: { linkedTask: 1 } },
      );
      await expect(
        taskService.transitionAssignedTask(
          taskId,
          String(serviceId),
          'ASSIGNED' as any,
          'IN_PROGRESS' as any,
        ),
      ).rejects.toThrow('not finalized');
      await unable(taskId).expect(409);
    },
  );

  it('continues overdue in-progress work without resetting progress or assignment', async () => {
    const { id, taskId } = await activeIssue(false);
    await taskService.transitionAssignedTask(
      taskId,
      String(serviceId),
      'ASSIGNED' as any,
      'IN_PROGRESS' as any,
    );
    await tasks.updateOne({ _id: taskId }, { $set: { dueAt: new Date(0) } });
    await resume(id, { taskId, dueAt: '2032-01-01T00:00:00Z' }).expect(201);
    const saved = await tasks.findById(taskId).lean();
    expect(saved?.status).toBe('IN_PROGRESS');
    expect(String(saved?.assignedTo)).toBe(String(serviceId));
    expect(saved?.continuationHistory).toHaveLength(1);
    expect((await issues.findById(id).lean())?.status).toBe('ASSIGNED');
  });

  it('close never selects a completed historical task instead of current linked work', async () => {
    const { id, taskId, body } = await activeIssue();
    const result = await reassign(id, body).expect(201);
    await tasks.updateOne(
      { _id: taskId },
      {
        $set: {
          status: 'COMPLETED',
          completedAt: new Date(),
          workResult: 'Historical completion',
          assignedAt: new Date('2099-01-01'),
        },
      },
    );
    await close(id).expect(409);
    expect((await issues.findById(id).lean())?.linkedTask?.toString()).toBe(
      result.body.linkedTasks[0].id,
    );
  });

  it('blocks newly created replacement execution until link recovery completes', async () => {
    const { id, body } = await activeIssue();
    const original = issues.findOneAndUpdate.bind(issues);
    const spy = vi.spyOn(issues, 'findOneAndUpdate').mockImplementation(((
      filter: any,
      update: any,
      options: any,
    ) => {
      if (update.$set?.linkedTask) throw new Error('Injected link failure');
      return original(filter, update, options);
    }) as any);
    await reassign(id, body).expect(500);
    spy.mockRestore();
    const pending = (await issues.findById(id).lean())!.pendingReassignment!;
    await expect(
      taskService.transitionAssignedTask(
        pending.targetTaskId,
        String(replacementId),
        'ASSIGNED' as any,
        'IN_PROGRESS' as any,
      ),
    ).rejects.toThrow('not finalized');
    await unable(
      pending.targetTaskId,
      { reason: 'Unfinalized' },
      replacementId,
    ).expect(409);
    await reassign(id, body).expect(201);
    await taskService.transitionAssignedTask(
      pending.targetTaskId,
      String(replacementId),
      'ASSIGNED' as any,
      'IN_PROGRESS' as any,
    );
  });

  it.each(['continue', 'report'])(
    'paused cancellation cannot overwrite successful concurrent %s',
    async (operation) => {
      const { id, taskId, body } = await activeIssue();
      let releaseMutation!: () => void;
      let mutationReached!: () => void;
      let releaseCancel!: () => void;
      let cancelReached!: () => void;
      const mutationGate = new Promise<void>((resolve) => {
        releaseMutation = resolve;
      });
      const mutationPaused = new Promise<void>((resolve) => {
        mutationReached = resolve;
      });
      const cancelGate = new Promise<void>((resolve) => {
        releaseCancel = resolve;
      });
      const cancelPaused = new Promise<void>((resolve) => {
        cancelReached = resolve;
      });
      const canonical = taskService.assertCanonicalIssueTask.bind(taskService);
      vi.spyOn(taskService, 'assertCanonicalIssueTask').mockImplementationOnce(
        async (task) => {
          const result = await canonical(task);
          mutationReached();
          await mutationGate;
          return result;
        },
      );
      const mutation =
        operation === 'continue'
          ? resume(id, {
              taskId,
              instructions: 'Concurrent Continue wins',
            }).then((result) => result)
          : unable(taskId, { reason: 'Concurrent report wins' }).then(
              (result) => result,
            );
      await mutationPaused;
      const cancel = taskService.cancelIssueTask.bind(taskService);
      const spy = vi
        .spyOn(taskService, 'cancelIssueTask')
        .mockImplementationOnce(async (...args) => {
          cancelReached();
          await cancelGate;
          return cancel(...args);
        });
      const reassignment = reassign(id, body).then((result) => result);
      await cancelPaused;
      releaseMutation();
      expect((await mutation).status).toBe(
        operation === 'continue' ? 201 : 200,
      );
      releaseCancel();
      expect((await reassignment).status).toBe(409);
      spy.mockRestore();
      const saved = await tasks.findById(taskId).lean();
      expect(saved?.status).toBe('ASSIGNED');
      expect(
        (await issues.findById(id).lean())?.pendingReassignment,
      ).toBeUndefined();
      expect(
        await tasks.countDocuments({ sourceId: new Types.ObjectId(id) }),
      ).toBe(1);
      if (operation === 'continue')
        expect(saved?.instructions).toBe('Concurrent Continue wins');
      else {
        expect(saved?.blockerHistory).toHaveLength(2);
        await reassign(id, body).expect(201);
      }
    },
  );

  it.each(['continue', 'report'])(
    'paused %s cannot overwrite cancellation that wins first',
    async (operation) => {
      const { id, taskId, body } = await activeIssue();
      let release!: () => void;
      let reached!: () => void;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      const paused = new Promise<void>((resolve) => {
        reached = resolve;
      });
      const canonical = taskService.assertCanonicalIssueTask.bind(taskService);
      vi.spyOn(taskService, 'assertCanonicalIssueTask').mockImplementationOnce(
        async (task) => {
          const result = await canonical(task);
          reached();
          await gate;
          return result;
        },
      );
      const mutation =
        operation === 'continue'
          ? resume(id, { taskId, instructions: 'Must not persist' }).then(
              (result) => result,
            )
          : unable(taskId, { reason: 'Must not persist' }).then(
              (result) => result,
            );
      await paused;
      await reassign(id, body).expect(201);
      release();
      expect((await mutation).status).toBe(409);
      const saved = await tasks.findById(taskId).lean();
      expect(saved?.status).toBe('CANCELLED');
      expect(saved?.instructions).toBeUndefined();
      expect(saved?.blockerHistory).toHaveLength(1);
      expect(
        await tasks.countDocuments({
          sourceId: new Types.ObjectId(id),
          status: { $in: ['ASSIGNED', 'IN_PROGRESS'] },
        }),
      ).toBe(1);
    },
  );

  it('rejects uppercase same-assignee reassignment without cancellation', async () => {
    const { id, taskId, body } = await activeIssue();
    await reassign(id, {
      ...body,
      taskId: taskId.toUpperCase(),
      assigneeId: String(serviceId).toUpperCase(),
    }).expect(400);
    expect((await tasks.findById(taskId).lean())?.status).toBe('ASSIGNED');
    expect(
      (await issues.findById(id).lean())?.pendingReassignment,
    ).toBeUndefined();
  });

  it('hides resolution audits and recovery state from customer', async () => {
    const { id, body } = await activeIssue();
    vi.spyOn(taskService, 'create').mockRejectedValueOnce(
      new Error('Injected create failure'),
    );
    await reassign(id, body).expect(500);
    const customer = await get(id, 'CUSTOMER', customerId).expect(200);
    for (const field of [
      'pendingReassignment',
      'reassignmentHistory',
      'resolutionTasks',
    ])
      expect(customer.body).not.toHaveProperty(field);
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
      expect(
        await tasks.countDocuments({ sourceId: new Types.ObjectId(id) }),
      ).toBe(0);
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
    const original = taskService.issueTask.bind(taskService);
    vi.spyOn(taskService, 'issueTask').mockImplementationOnce(
      async (sourceId, currentTaskId) => {
        const task = await original(sourceId, currentTaskId);
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

  it('blocks unfinalized execution and recovers after task commit then issue write failure', async () => {
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
    await expect(
      taskService.transitionAssignedTask(
        String(task!._id),
        String(serviceId),
        'ASSIGNED' as any,
        'IN_PROGRESS' as any,
      ),
    ).rejects.toThrow('not finalized');
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
      status: 'ASSIGNED',
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
