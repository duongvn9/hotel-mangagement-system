import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  Global,
  Module,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { validate } from 'class-validator';
import { Connection, Model, Mongoose, Types } from 'mongoose';
import { Role } from '../roles/schemas/role.schema.js';
import { User } from '../users/schemas/user.schema.js';
import { CreateTaskDto } from './dto/create-task.dto.js';
import { Task, TaskSchema } from './schemas/task.schema.js';
import {
  canTransitionTaskStatus,
  SERVICE_ORDER_EXECUTION_TASK_TYPE,
  TaskSourceType,
  TaskStatus,
} from './task-contract.js';
import { TasksModule } from './tasks.module.js';
import { TASK_SOURCE_COLLECTIONS, TasksService } from './tasks.service.js';

const ID = '6718a1b2c3d4e5f601234567';
const input: CreateTaskDto = {
  title: ' Deliver towels ',
  taskType: 'SERVICE',
  priority: 'NORMAL',
  assigneeId: ID,
  sourceId: ID,
  sourceType: TaskSourceType.ServiceOrder,
};
function setup(role = 'SERVICE_STAFF', active = true, sourceExists = true) {
  const tasks = {
    create: vi.fn(async (doc: object) => ({ _id: ID, ...doc })),
    collection: { createIndex: vi.fn(async () => 'unique_active_task_work') },
    findOne: vi.fn(() => ({
      lean: async () => ({ sourceType: TaskSourceType.ServiceOrder }),
    })),
    findOneAndUpdate: vi.fn(async () => ({ _id: ID }) as object | null),
  };
  const users = {
    findById: vi.fn(() => ({ lean: async () => ({ role, isActive: active }) })),
  };
  const roles = { exists: vi.fn(async () => null as object | null) };
  const findOne = vi.fn(async () => (sourceExists ? { _id: ID } : null));
  const connection = { collection: vi.fn(() => ({ findOne })) };
  const service = new TasksService(
    tasks as unknown as Model<Task>,
    users as unknown as Model<User>,
    roles as unknown as Model<Role>,
    connection as unknown as Connection,
  );
  return { tasks, users, roles, connection, findOne, service };
}

describe('H8 task contract', () => {
  for (const from of [...Object.values(TaskStatus), 'PENDING', undefined]) {
    for (const to of [...Object.values(TaskStatus), 'PENDING', undefined]) {
      it(`transition ${from} -> ${to}`, () => {
        expect(canTransitionTaskStatus(from, to)).toBe(
          (from === 'ASSIGNED' && to === 'IN_PROGRESS') ||
            (from === 'IN_PROGRESS' && to === 'COMPLETED'),
        );
      });
    }
  }

  it('exports exact storage values, references, timestamps and indexes', () => {
    expect(Object.values(TaskStatus)).toEqual([
      'ASSIGNED',
      'IN_PROGRESS',
      'COMPLETED',
    ]);
    expect(TaskSchema.path('assignedTo').options.ref).toBe('User');
    expect(TaskSchema.options.timestamps).toBe(true);
    expect(TaskSchema.indexes().map(([keys]) => keys)).toEqual([
      { assignedTo: 1, status: 1 },
      { status: 1 },
      { sourceType: 1, sourceId: 1 },
      { sourceType: 1, sourceId: 1, taskType: 1 },
    ]);
    expect(TaskSchema.indexes()[3][1]).toMatchObject({
      name: 'unique_active_task_work',
      unique: true,
      partialFilterExpression: { status: { $in: ['ASSIGNED', 'IN_PROGRESS'] } },
    });
    const model = new Mongoose().model(Task.name, TaskSchema);
    const doc = new model({
      title: 'Test',
      taskType: 'SERVICE',
      priority: 'NORMAL',
      assignedTo: ID,
      sourceType: TaskSourceType.Issue,
      sourceId: ID,
    });
    expect(doc.validateSync()).toBeUndefined();
    expect(doc.status).toBe(TaskStatus.Assigned);
    doc.sourceId = undefined as unknown as Types.ObjectId;
    expect(doc.validateSync()?.errors.sourceId).toBeDefined();
    doc.sourceType = 'UNKNOWN' as TaskSourceType;
    expect(doc.validateSync()?.errors.sourceType).toBeDefined();
    doc.status = 'PENDING' as TaskStatus;
    expect(doc.validateSync()?.errors.status).toBeDefined();
  });

  it('exposes TasksService to an importing Nest module without source modules', async () => {
    const { tasks, users, roles, connection } = setup();
    @Global()
    @Module({
      providers: [{ provide: getConnectionToken(), useValue: connection }],
      exports: [getConnectionToken()],
    })
    class MockDatabaseModule {}
    const module = await Test.createTestingModule({
      imports: [MockDatabaseModule, TasksModule],
    })
      .overrideProvider(getModelToken(Task.name))
      .useValue(tasks)
      .overrideProvider(getModelToken(User.name))
      .useValue(users)
      .overrideProvider(getModelToken(Role.name))
      .useValue(roles)
      .overrideProvider(getConnectionToken())
      .useValue(connection)
      .compile();
    expect(module.get(TasksService)).toBeInstanceOf(TasksService);
    await module.close();
  });

  it.each(Object.values(TaskSourceType))(
    'persists verified %s sources',
    async (sourceType) => {
      const { service, tasks, connection, findOne } = setup(
        sourceType === TaskSourceType.Maintenance
          ? 'OPERATIONS_STAFF'
          : 'SERVICE_STAFF',
      );
      const result = await service.create({
        ...input,
        sourceType,
        dueAt: '2026-11-01T08:00:00Z',
      });
      expect(connection.collection).toHaveBeenCalledWith(
        TASK_SOURCE_COLLECTIONS[sourceType],
      );
      expect(findOne).toHaveBeenCalledWith(
        { _id: new Types.ObjectId(ID) },
        { projection: { _id: 1 } },
      );
      expect(tasks.create).toHaveBeenCalledWith({
        title: 'Deliver towels',
        taskType: 'SERVICE',
        priority: 'NORMAL',
        sourceType,
        sourceId: new Types.ObjectId(ID),
        assignedTo: new Types.ObjectId(ID),
        assignedAt: expect.any(Date),
        status: 'ASSIGNED',
        dueAt: new Date('2026-11-01T08:00:00Z'),
      });
      expect(result).toMatchObject({ _id: ID, status: 'ASSIGNED' });
      expect(result).not.toHaveProperty('completedAt');
    },
  );

  it.each(['SERVICE_STAFF', 'OPERATIONS_STAFF'])(
    'accepts active %s',
    async (role) => {
      const { service, roles } = setup(role);
      await expect(
        service.create({ ...input, sourceType: TaskSourceType.Issue }),
      ).resolves.toBeDefined();
      expect(roles.exists).not.toHaveBeenCalled();
    },
  );

  it('does not infer specialization from custom role execution permission', async () => {
    const { service, roles, tasks } = setup('HOUSEKEEPING');
    roles.exists.mockResolvedValue({ _id: ID });
    await expect(service.create(input)).rejects.toThrow(BadRequestException);
    expect(tasks.create).not.toHaveBeenCalled();
  });

  it.each(['CUSTOMER', 'RECEPTIONIST', 'MANAGER', 'UNKNOWN'])(
    'rejects %s without execution permission',
    async (role) => {
      const { service, tasks } = setup(role);
      await expect(service.create(input)).rejects.toThrow(BadRequestException);
      expect(tasks.create).not.toHaveBeenCalled();
    },
  );

  it('rejects missing or inactive assignees before source access', async () => {
    const context = setup('SERVICE_STAFF', false);
    await expect(context.service.create(input)).rejects.toThrow(
      BadRequestException,
    );
    context.users.findById.mockReturnValue({ lean: async () => null! });
    await expect(context.service.create(input)).rejects.toThrow(
      NotFoundException,
    );
    expect(context.connection.collection).not.toHaveBeenCalled();
    expect(context.tasks.create).not.toHaveBeenCalled();
  });

  it.each(Object.values(TaskSourceType))(
    'fails closed for absent %s',
    async (sourceType) => {
      const { service, tasks } = setup(
        sourceType === TaskSourceType.Maintenance
          ? 'OPERATIONS_STAFF'
          : 'SERVICE_STAFF',
        true,
        false,
      );
      await expect(service.create({ ...input, sourceType })).rejects.toThrow(
        'Task source does not exist',
      );
      expect(tasks.create).not.toHaveBeenCalled();
    },
  );

  it.each([
    { title: ' ' },
    { taskType: '' },
    { priority: 1 },
    { sourceType: 'OTHER' },
    { sourceId: 'invalid' },
    { sourceId: null },
    { assigneeId: 'invalid' },
    { dueAt: '2026-02-30' },
    { dueAt: null },
    { status: 'COMPLETED' },
    { completedAt: '2026-10-23' },
    { workResult: 'Injected' },
  ])('validates DTO and direct service input %j', async (patch) => {
    const value = { ...input, ...patch };
    expect(
      await validate(Object.assign(new CreateTaskDto(), value), {
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    ).not.toHaveLength(0);
    const { service, users, tasks } = setup();
    await expect(service.create(value as CreateTaskDto)).rejects.toThrow(
      BadRequestException,
    );
    expect(users.findById).not.toHaveBeenCalled();
    expect(tasks.create).not.toHaveBeenCalled();
  });

  it.each([
    [TaskSourceType.ServiceOrder, 'OPERATIONS_STAFF'],
    [TaskSourceType.Maintenance, 'SERVICE_STAFF'],
  ])('rejects wrong specialization for %s', async (sourceType, role) => {
    const { service, tasks } = setup(role);
    await expect(service.create({ ...input, sourceType })).rejects.toThrow(
      BadRequestException,
    );
    expect(tasks.create).not.toHaveBeenCalled();
  });

  it('initializes the actual schema unique index before a write', async () => {
    const { service, tasks } = setup();
    let ready = false;
    tasks.collection.createIndex.mockImplementation(async () => {
      await Promise.resolve();
      ready = true;
      return 'unique_active_task_work';
    });
    tasks.create.mockImplementation(async (doc) => {
      expect(ready).toBe(true);
      return { _id: ID, ...doc };
    });
    await service.create(input);
    const [keys, options] = TaskSchema.indexes()[3];
    expect(tasks.collection.createIndex).toHaveBeenCalledWith(keys, options);
  });

  it('simulates atomic concurrent creation across assignees, not a preflight lookup', async () => {
    const { service, tasks } = setup();
    const active = new Set<string>();
    tasks.create.mockImplementation(async (doc) => {
      const value = doc as Record<string, unknown>;
      const key = `${String(value.sourceType)}:${String(value.sourceId)}:${String(value.taskType)}`;
      if (active.has(key))
        throw Object.assign(new Error('duplicate'), { code: 11000 });
      active.add(key);
      return { _id: ID, ...doc };
    });
    const results = await Promise.allSettled([
      service.create(input),
      service.create({
        ...input,
        title: 'Another title',
        assigneeId: '6718a1b2c3d4e5f601234568',
      }),
    ]);
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      results.find((result) => result.status === 'rejected'),
    ).toMatchObject({ reason: expect.any(ConflictException) });
    expect(tasks.collection.createIndex).toHaveBeenCalledTimes(1);
    await expect(
      service.create({ ...input, taskType: 'OTHER_WORK' }),
    ).resolves.toBeDefined();
  });

  it.each([11000, 13])(
    'fails closed when index initialization fails with %s',
    async (code) => {
      const { service, tasks } = setup();
      const error = Object.assign(new Error('Index failed'), { code });
      tasks.collection.createIndex.mockRejectedValue(error);
      await expect(service.create(input)).rejects.toThrow(
        code === 11000 ? ConflictException : error,
      );
      expect(tasks.create).not.toHaveBeenCalled();
    },
  );

  it('preserves nonduplicate write errors and maps E11000 to conflict', async () => {
    const { service, tasks } = setup();
    const failure = Object.assign(new Error('Write unavailable'), { code: 91 });
    tasks.create.mockRejectedValueOnce(failure);
    await expect(service.create(input)).rejects.toBe(failure);
    tasks.create.mockRejectedValueOnce(
      Object.assign(new Error('duplicate'), { code: 11000 }),
    );
    await expect(service.create(input)).rejects.toThrow(ConflictException);
  });

  for (const from of Object.values(TaskStatus)) {
    for (const to of Object.values(TaskStatus)) {
      it(`persists only valid CAS edge ${from} -> ${to}`, async () => {
        const { service, tasks } = setup();
        const operation = service.transitionAssignedTask(
          ID,
          ID,
          from,
          to,
          to === TaskStatus.Completed ? ' Resolved ' : undefined,
        );
        if (!canTransitionTaskStatus(from, to)) {
          await expect(operation).rejects.toThrow(ConflictException);
          expect(tasks.findOneAndUpdate).not.toHaveBeenCalled();
          expect(tasks.findOne).not.toHaveBeenCalled();
          return;
        }
        await expect(operation).resolves.toEqual({ _id: ID });
        expect(tasks.findOneAndUpdate).toHaveBeenCalledWith(
          {
            _id: new Types.ObjectId(ID),
            assignedTo: new Types.ObjectId(ID),
            status: from,
          },
          {
            $set: {
              status: to,
              ...(to === TaskStatus.Completed
                ? { workResult: 'Resolved', completedAt: expect.any(Date) }
                : {}),
            },
          },
          { new: true, runValidators: true },
        );
        if (to === TaskStatus.Completed) {
          const update = tasks.findOneAndUpdate.mock.calls[0] as unknown as [
            object,
            { $set: { completedAt: Date } },
          ];
          expect(update[1].$set.completedAt.toISOString()).toMatch(/Z$/);
        }
      });
    }
  }

  it.each([undefined, '', ' ', null, 42])(
    'requires completion work result %s',
    async (result) => {
      const { service, tasks } = setup();
      await expect(
        service.transitionAssignedTask(
          ID,
          ID,
          TaskStatus.InProgress,
          TaskStatus.Completed,
          result as string,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(tasks.findOneAndUpdate).not.toHaveBeenCalled();
    },
  );

  it('rejects bad IDs, unexpected result and unknown lifecycle values without updates', async () => {
    const { service, tasks } = setup();
    await expect(
      service.transitionAssignedTask(
        'bad',
        ID,
        TaskStatus.Assigned,
        TaskStatus.InProgress,
      ),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.transitionAssignedTask(
        ID,
        'bad',
        TaskStatus.Assigned,
        TaskStatus.InProgress,
      ),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.transitionAssignedTask(
        ID,
        ID,
        TaskStatus.Assigned,
        TaskStatus.InProgress,
        'premature',
      ),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.transitionAssignedTask(
        ID,
        ID,
        'PENDING' as TaskStatus,
        TaskStatus.InProgress,
      ),
    ).rejects.toThrow(ConflictException);
    expect(tasks.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('rejects missing, foreign or stale tasks without updating', async () => {
    const { service, tasks, users } = setup();
    tasks.findOne.mockReturnValue({ lean: async () => null! });
    await expect(
      service.transitionAssignedTask(
        ID,
        ID,
        TaskStatus.Assigned,
        TaskStatus.InProgress,
      ),
    ).rejects.toThrow(ConflictException);
    expect(users.findById).not.toHaveBeenCalled();
    expect(tasks.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it.each(['inactive', 'wrong-role', 'missing'])(
    'rejects %s transition actor',
    async (kind) => {
      const { service, tasks, users } = setup(
        kind === 'wrong-role' ? 'OPERATIONS_STAFF' : 'SERVICE_STAFF',
        kind !== 'inactive',
      );
      if (kind === 'missing')
        users.findById.mockReturnValue({ lean: async () => null! });
      await expect(
        service.transitionAssignedTask(
          ID,
          ID,
          TaskStatus.Assigned,
          TaskStatus.InProgress,
        ),
      ).rejects.toThrow(
        kind === 'missing' ? NotFoundException : BadRequestException,
      );
      expect(tasks.findOneAndUpdate).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['CUSTOM_EXECUTOR', true, true, true],
    ['CUSTOM_EXECUTOR', true, false, false],
    ['CUSTOM_EXECUTOR', false, true, false],
    ['MANAGER', true, true, false],
    ['OPERATIONS_STAFF', true, true, false],
  ] as const)(
    'transition eligibility %s active=%s permission=%s allowed=%s',
    async (role, active, permission, allowed) => {
      const { service, roles, tasks } = setup(role, active);
      roles.exists.mockResolvedValue(permission ? { _id: ID } : null);
      const operation = service.transitionAssignedTask(
        ID,
        ID,
        TaskStatus.Assigned,
        TaskStatus.InProgress,
      );
      if (allowed) await expect(operation).resolves.toBeDefined();
      else {
        await expect(operation).rejects.toThrow(BadRequestException);
        expect(tasks.findOneAndUpdate).not.toHaveBeenCalled();
      }
    },
  );

  it('bounds trimmed completion work result in the core', async () => {
    const { service, tasks } = setup();
    await expect(
      service.transitionAssignedTask(
        ID,
        ID,
        TaskStatus.InProgress,
        TaskStatus.Completed,
        'x'.repeat(2001),
      ),
    ).rejects.toThrow('Work result must not exceed 2000 characters');
    expect(tasks.findOneAndUpdate).not.toHaveBeenCalled();
  });

  describe.each([
    [TaskStatus.Assigned, TaskStatus.InProgress],
    [TaskStatus.InProgress, TaskStatus.Completed],
  ])('service order execution %s -> %s', (from, to) => {
    const sourceId = new Types.ObjectId();
    const taskId = new Types.ObjectId(ID);
    const executionTask = {
      _id: taskId,
      sourceId,
      sourceType: TaskSourceType.ServiceOrder,
      taskType: SERVICE_ORDER_EXECUTION_TASK_TYPE,
      status: from,
    };

    it.each([
      null,
      { reviewStatus: 'ACCEPTED', executionStatus: 'ASSIGNING' },
      {
        linkedTask: taskId,
        reviewStatus: 'ACCEPTED',
        executionStatus: 'ASSIGNING',
      },
      {
        linkedTask: new Types.ObjectId(),
        reviewStatus: 'ACCEPTED',
        executionStatus: 'ASSIGNED',
      },
      {
        linkedTask: taskId,
        reviewStatus: 'REJECTED',
        executionStatus: 'ASSIGNED',
      },
      {
        linkedTask: taskId,
        reviewStatus: 'ACCEPTED',
        executionStatus: 'NOT_STARTED',
      },
    ])('rejects noncanonical or pending order %j before CAS', async (order) => {
      const { service, tasks, findOne } = setup();
      tasks.findOne.mockReturnValue({ lean: async () => executionTask });
      findOne.mockImplementation(async (...args: unknown[]) => {
        const filter = args[0] as {
          linkedTask: Types.ObjectId;
          reviewStatus: string;
          executionStatus: { $in: string[] };
        };
        return order &&
          order.linkedTask?.equals(filter.linkedTask) &&
          order.reviewStatus === filter.reviewStatus &&
          filter.executionStatus.$in.includes(order.executionStatus)
          ? { _id: ID }
          : null!;
      });
      await expect(
        service.transitionAssignedTask(
          ID,
          ID,
          from,
          to,
          to === TaskStatus.Completed ? 'Done' : undefined,
        ),
      ).rejects.toThrow(ConflictException);
      expect(findOne).toHaveBeenCalledWith(
        {
          _id: sourceId,
          linkedTask: taskId,
          reviewStatus: 'ACCEPTED',
          executionStatus: { $in: Object.values(TaskStatus) },
        },
        { projection: { _id: 1 } },
      );
      expect(tasks.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it('allows finalized canonical work even when its progress projection lags', async () => {
      const { service, tasks, findOne } = setup();
      tasks.findOne.mockReturnValue({ lean: async () => executionTask });
      const repair = vi
        .spyOn(service, 'repairServiceOrderExecution')
        .mockResolvedValue(undefined);
      tasks.findOneAndUpdate.mockImplementation(async () => {
        expect(findOne).toHaveBeenCalledTimes(1);
        return { ...executionTask, status: to };
      });
      await expect(
        service.transitionAssignedTask(
          ID,
          ID,
          from,
          to,
          to === TaskStatus.Completed ? 'Done' : undefined,
        ),
      ).resolves.toMatchObject({ status: to });
      expect(repair).toHaveBeenCalledWith({ ...executionTask, status: to });
    });
  });

  it('rejects a concurrent status or assignee change at the final CAS', async () => {
    const { service, tasks } = setup();
    tasks.findOneAndUpdate.mockResolvedValue(null);
    await expect(
      service.transitionAssignedTask(
        ID,
        ID,
        TaskStatus.Assigned,
        TaskStatus.InProgress,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('allows only one concurrent transition in an atomic persistence simulation', async () => {
    const { service, tasks } = setup();
    let assigned = true;
    tasks.findOneAndUpdate.mockImplementation(async () => {
      if (!assigned) return null;
      assigned = false;
      return { _id: ID };
    });
    const results = await Promise.allSettled(
      [1, 2].map(() =>
        service.transitionAssignedTask(
          ID,
          ID,
          TaskStatus.Assigned,
          TaskStatus.InProgress,
        ),
      ),
    );
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      results.find((result) => result.status === 'rejected'),
    ).toMatchObject({ reason: expect.any(ConflictException) });
  });

  it('propagates transition DB errors without a successful result', async () => {
    const { service, tasks } = setup();
    const error = new Error('CAS unavailable');
    tasks.findOneAndUpdate.mockRejectedValue(error);
    await expect(
      service.transitionAssignedTask(
        ID,
        ID,
        TaskStatus.Assigned,
        TaskStatus.InProgress,
      ),
    ).rejects.toBe(error);
  });

  it('propagates source and persistence failures without pretending to save', async () => {
    const { service, findOne, tasks } = setup();
    findOne.mockRejectedValueOnce(new Error('Source unavailable'));
    await expect(service.create(input)).rejects.toThrow('Source unavailable');
    expect(tasks.create).not.toHaveBeenCalled();
    tasks.create.mockRejectedValueOnce(new Error('Write failed'));
    await expect(service.create(input)).rejects.toThrow('Write failed');
  });
});
