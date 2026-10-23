import { BadRequestException, Global, Module } from '@nestjs/common';
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
  const tasks = { create: vi.fn(async (doc: object) => ({ _id: ID, ...doc })) };
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
    ]);
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
      const { service, tasks, connection, findOne } = setup();
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
      await expect(service.create(input)).resolves.toBeDefined();
      expect(roles.exists).not.toHaveBeenCalled();
    },
  );

  it('supports existing active custom role task:execute policy', async () => {
    const { service, roles } = setup('HOUSEKEEPING');
    roles.exists.mockResolvedValue({ _id: ID });
    await service.create(input);
    expect(roles.exists).toHaveBeenCalledWith({
      code: 'HOUSEKEEPING',
      isActive: true,
      permissions: { $all: ['task:execute'] },
    });
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
      BadRequestException,
    );
    expect(context.connection.collection).not.toHaveBeenCalled();
    expect(context.tasks.create).not.toHaveBeenCalled();
  });

  it.each(Object.values(TaskSourceType))(
    'fails closed for absent %s',
    async (sourceType) => {
      const { service, tasks } = setup('SERVICE_STAFF', true, false);
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

  it('propagates source and persistence failures without pretending to save', async () => {
    const { service, findOne, tasks } = setup();
    findOne.mockRejectedValueOnce(new Error('Source unavailable'));
    await expect(service.create(input)).rejects.toThrow('Source unavailable');
    expect(tasks.create).not.toHaveBeenCalled();
    tasks.create.mockRejectedValueOnce(new Error('Write failed'));
    await expect(service.create(input)).rejects.toThrow('Write failed');
  });
});
