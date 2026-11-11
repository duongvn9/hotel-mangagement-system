import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { randomUUID } from 'node:crypto';
import { IssuesService } from './issues.service.js';
import { IssueContextAdapter } from './issue-context.adapter.js';
import { Issue } from './schemas/issue.schema.js';
import { Booking } from '../bookings/schemas/booking.schema.js';
import { ListIssuesQuery } from './dto/list-issues.dto.js';
import { User } from '../users/schemas/user.schema.js';
import { TasksService } from '../tasks/tasks.service.js';

const query = (result: unknown) => {
  const chain = {
    select: vi.fn(),
    sort: vi.fn(),
    skip: vi.fn(),
    limit: vi.fn(),
    lean: async () => result,
  };
  for (const key of ['select', 'sort', 'skip', 'limit'] as const)
    chain[key].mockReturnValue(chain);
  return chain;
};

describe('Customer issue reporting', () => {
  const owner = new Types.ObjectId();
  const booking = new Types.ObjectId();
  const actor = {
    id: String(owner),
    email: 'owner@example.test',
    role: 'CUSTOMER',
  };
  const dto = () => ({
    title: 'Lamp',
    category: 'Lighting',
    description: 'Broken',
    bookingId: String(booking),
    requestId: randomUUID(),
  });
  const resolve = vi.fn();
  const records: (Issue & { _id: Types.ObjectId })[] = [];
  const issues = {
    findOne: vi.fn((key: { requestId: string }) =>
      query(records.find((entry) => entry.requestId === key.requestId) ?? null),
    ),
    create: vi.fn(async (input: Issue) => {
      if (records.some((entry) => entry.requestId === input.requestId))
        throw { code: 11000 };
      const record = { ...input, _id: new Types.ObjectId() };
      records.push(record);
      return record;
    }),
  };
  const service = new IssuesService(
    issues as unknown as Model<Issue>,
    { resolve } as unknown as IssueContextAdapter,
    {} as Model<Booking>,
    {} as Model<User>,
    {} as TasksService,
  );
  beforeEach(() => {
    vi.clearAllMocks();
    records.length = 0;
    resolve.mockResolvedValue({ booking });
  });
  it('deduplicates concurrent requests using the persisted fingerprint', async () => {
    const input = dto();
    const results = await Promise.all([
      service.create(input, actor.id),
      service.create(input, actor.id),
    ]);
    expect(results[0]).toEqual(results[1]);
    expect(records).toHaveLength(1);
    expect(records[0].requestFingerprint).toMatch(/^customer:/);
  });
  it('replays before resolving revoked eligibility and rejects new requests', async () => {
    const input = dto();
    const original = await service.create(input, actor.id);
    resolve.mockRejectedValue(new Error('Booking not found'));
    await expect(service.create(input, actor.id)).resolves.toEqual(original);
    await expect(service.create(dto(), actor.id)).rejects.toThrow(
      'Booking not found',
    );
    expect(resolve).toHaveBeenCalledTimes(2);
  });
  it.each([
    'title',
    'category',
    'description',
    'bookingId',
    'roomId',
    'serviceOrderId',
  ])('conflicts on changed %s', async (field) => {
    const input = dto();
    await service.create(input, actor.id);
    await expect(
      service.create(
        {
          ...input,
          [field]: field.endsWith('Id')
            ? String(new Types.ObjectId())
            : 'changed',
        },
        actor.id,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });
  it('cannot replay a staff-originated record', async () => {
    const input = dto();
    await service.create(input, actor.id);
    records[0].sourceTask = new Types.ObjectId();
    await expect(service.create(input, actor.id)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
  it('requires a UUID request ID in direct service calls', async () => {
    await expect(
      service.create({ ...dto(), requestId: undefined } as never, actor.id),
    ).rejects.toThrow('Invalid input');
    expect(resolve).not.toHaveBeenCalled();
  });
});

describe('Issue readable staff context', () => {
  it('resolves inactive historical actors and safe booking context without leaking staff to customers', async () => {
    const reporter = new Types.ObjectId();
    const staff = new Types.ObjectId();
    const room = new Types.ObjectId();
    const booking = new Types.ObjectId();
    const record = {
      _id: new Types.ObjectId(),
      booking,
      reporter,
      title: 'Lamp',
      category: 'Lighting',
      description: 'Broken',
      status: 'ASSIGNED',
      priority: 'NORMAL',
      reportedAt: new Date(),
      reviewedBy: staff,
      assignmentAssignee: staff,
      assignmentRequestedBy: staff,
      reassignmentHistory: [
        {
          actorId: String(staff),
          assigneeId: String(staff),
          recoveryActors: [String(staff)],
        },
      ],
    };
    const users = {
      find: vi.fn(() =>
        query([
          { _id: reporter, fullName: 'Guest' },
          { _id: staff, fullName: 'Historical employee', isActive: false },
        ]),
      ),
    };
    const service = new IssuesService(
      { findOne: () => query(record) } as unknown as Model<Issue>,
      {
        roomNumbers: async () => new Map([[String(room), '101']]),
      } as unknown as IssueContextAdapter,
      {
        find: () => query([{ _id: booking, code: 'BK001', rooms: [room] }]),
      } as unknown as Model<Booking>,
      users as unknown as Model<User>,
      {
        issueTaskHistory: async () => [
          {
            _id: new Types.ObjectId(),
            title: 'Repair',
            assignedTo: staff,
            assignedAt: new Date(),
            blockerHistory: [
              { reportedBy: String(staff), resolvedBy: String(staff) },
            ],
            continuationHistory: [{ actorId: String(staff) }],
            cancellation: {
              actorId: String(staff),
              recoveryActorId: String(new Types.ObjectId()),
            },
          },
        ],
      } as unknown as TasksService,
    );
    const actor = {
      id: String(reporter),
      email: 'guest@example.test',
      role: 'RECEPTIONIST',
    };
    const result = await service.findOne(String(record._id), actor);
    expect(result).toMatchObject({
      reporterId: String(reporter),
      reporterName: 'Guest',
      bookingCode: 'BK001',
      roomNumbers: ['101'],
      reviewedByName: 'Historical employee',
      assigneeName: 'Historical employee',
      assignmentRequestedByName: 'Historical employee',
      resolutionTasks: [
        {
          assigneeName: 'Historical employee',
          blockerHistory: [
            {
              reportedByName: 'Historical employee',
              resolvedByName: 'Historical employee',
            },
          ],
          continuationHistory: [{ actorName: 'Historical employee' }],
          cancellation: {
            actorName: 'Historical employee',
            recoveryActorName: null,
          },
        },
      ],
      reassignmentHistory: [
        {
          actorName: 'Historical employee',
          assigneeName: 'Historical employee',
          recoveryActorNames: ['Historical employee'],
        },
      ],
    });
    expect(users.find).toHaveBeenCalledWith({
      _id: { $in: expect.any(Array) },
    });
    users.find.mockClear();
    const customer = await service.findOne(String(record._id), {
      ...actor,
      role: 'CUSTOMER',
    });
    expect(customer).toMatchObject({
      bookingCode: 'BK001',
      roomNumbers: ['101'],
    });
    for (const key of [
      'reporterName',
      'reporterId',
      'reviewedByName',
      'assigneeName',
      'assignmentRequestedByName',
      'resolutionTasks',
      'reassignmentHistory',
    ])
      expect(customer).not.toHaveProperty(key);
    expect(users.find).not.toHaveBeenCalled();
  });
});

describe('Authorized issue room display', () => {
  const owner = new Types.ObjectId();
  const booking = new Types.ObjectId();
  const room = new Types.ObjectId();
  const missing = new Types.ObjectId();
  const actor = {
    id: String(owner),
    email: 'owner@example.test',
    role: 'CUSTOMER',
  };
  const record = {
    _id: new Types.ObjectId(),
    booking,
    room,
    title: 'Lamp',
    category: 'Lighting',
    description: 'Broken',
    status: 'PENDING_REVIEW',
    priority: 'NORMAL',
    reportedAt: new Date(),
    reviewNotes: 'Internal',
    reviewedBy: new Types.ObjectId(),
    assignmentInstructions: 'Private',
    assignmentAssignee: new Types.ObjectId(),
    reassignmentHistory: [{ reason: 'Private' }],
  };
  const roomNumbers = vi.fn(async () => new Map([[String(room), '101']]));
  const issues = {
    find: vi.fn(() =>
      query([
        record,
        { ...record, room: undefined },
        { ...record, room: missing },
      ]),
    ),
    findOne: vi.fn(() => query(record)),
    countDocuments: vi.fn(async () => 3),
  };
  const bookings = { find: vi.fn(() => query([{ _id: booking }])) };
  const service = new IssuesService(
    issues as unknown as Model<Issue>,
    { roomNumbers } as unknown as IssueContextAdapter,
    bookings as unknown as Model<Booking>,
    {} as Model<User>,
    {} as TasksService,
  );
  beforeEach(() => vi.clearAllMocks());

  it('enriches only retrieved list room links in one bulk lookup with null fallbacks', async () => {
    const result = await service.list(new ListIssuesQuery(), actor);
    expect(result.items.map((item) => item.roomNumber)).toEqual([
      '101',
      null,
      null,
    ]);
    expect(result.items[0].roomId).toBe(String(room));
    expect(roomNumbers).toHaveBeenCalledExactlyOnceWith([room, missing]);
    for (const item of result.items) {
      expect(item).not.toHaveProperty('reviewNotes');
      expect(item).not.toHaveProperty('reviewedBy');
      expect(item).not.toHaveProperty('assignmentInstructions');
      expect(item).not.toHaveProperty('assigneeId');
      expect(item).not.toHaveProperty('reassignmentHistory');
    }
  });

  it('enriches authorized detail without exposing internal history or staff identities', async () => {
    const result = await service.findOne(String(record._id), actor);
    expect(result.roomNumber).toBe('101');
    expect(result.linkedTasks).toEqual([]);
    expect(result).not.toHaveProperty('resolutionTasks');
    expect(result).not.toHaveProperty('reassignmentHistory');
    expect(result).not.toHaveProperty('reviewNotes');
    expect(result).not.toHaveProperty('reviewedBy');
    expect(result).not.toHaveProperty('assigneeId');
    expect(issues.findOne).toHaveBeenCalledWith({
      _id: record._id,
      $or: [
        { reporter: owner, sourceTask: { $exists: false } },
        { booking: { $in: [booking] }, sourceTask: { $exists: true } },
      ],
    });
    expect(bookings.find).toHaveBeenCalledWith({
      customer: owner,
      isActive: true,
    });
  });

  it('returns 404 before room lookup when detail is outside either origin scope', async () => {
    issues.findOne.mockReturnValueOnce(query(null));
    await expect(
      service.findOne(String(record._id), actor),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(roomNumbers).not.toHaveBeenCalled();
  });
});

describe('Sanitized customer issue history', () => {
  const id = new Types.ObjectId();
  const taskId = new Types.ObjectId();
  const oldTaskId = new Types.ObjectId();
  const actor = {
    id: String(new Types.ObjectId()),
    email: 'owner@example.test',
    role: 'CUSTOMER',
  };
  const at = (day: number) =>
    new Date(`2026-11-${String(day).padStart(2, '0')}T10:00:00.000Z`);
  let record: any;
  let history: any[];
  const issues = { findOne: vi.fn(() => query(record)) };
  const tasks = { issueTaskHistory: vi.fn(async () => history) };
  const roomNumbers = vi.fn(async () => new Map());
  const service = new IssuesService(
    issues as unknown as Model<Issue>,
    { roomNumbers } as unknown as IssueContextAdapter,
    { find: () => query([]) } as unknown as Model<Booking>,
    {} as Model<User>,
    tasks as unknown as TasksService,
  );
  beforeEach(() => {
    vi.clearAllMocks();
    record = {
      _id: id,
      booking: new Types.ObjectId(),
      title: 'Lamp',
      description: 'Broken',
      category: 'Lighting',
      priority: 'NORMAL',
      status: 'CLOSED',
      reportedAt: at(1),
      reviewedAt: at(2),
      assignedAt: at(5),
      closedAt: at(7),
      linkedTask: taskId,
      reviewNotes: 'private review',
      closureConclusion: 'private conclusion',
      assignmentInstructions: 'private instructions',
      reviewedBy: new Types.ObjectId(),
      pendingReassignment: {
        requestedAt: at(8).toISOString(),
        reason: 'private pending',
      },
      reassignmentHistory: [
        {
          taskId: String(oldTaskId),
          targetTaskId: String(taskId),
          completedAt: at(5).toISOString(),
          requestedAt: at(4).toISOString(),
          actorId: actor.id,
          requestId: 'private audit',
          reason: 'private reason',
        },
      ],
    };
    history = [
      {
        _id: taskId,
        assignedAt: at(5),
        completedAt: at(6),
        status: 'COMPLETED',
        workResult: 'private result',
      },
      {
        _id: oldTaskId,
        assignedAt: at(3),
        status: 'CANCELLED',
        continuationHistory: [
          {
            at: at(4),
            actorId: actor.id,
            instructions: 'private continuation',
          },
        ],
      },
    ];
  });

  it('returns only chronological event types and persisted timestamps, never internal history', async () => {
    const result = await service.findOne(String(id), actor);
    expect(result).toHaveProperty('customerHistory', [
      { type: 'REPORTED', at: at(1).toISOString() },
      { type: 'REVIEWED', at: at(2).toISOString() },
      { type: 'ASSIGNED', at: at(3).toISOString() },
      { type: 'CONTINUED', at: at(4).toISOString() },
      { type: 'REASSIGNED', at: at(5).toISOString() },
      { type: 'TASK_COMPLETED', at: at(6).toISOString() },
      { type: 'CLOSED', at: at(7).toISOString() },
    ]);
    expect(JSON.stringify(result)).not.toContain('private');
    expect(result.linkedTasks).toEqual([]);
    expect(result.linkedTasksAvailable).toBe(false);
    for (const field of [
      'resolutionTasks',
      'pendingReassignment',
      'reassignmentHistory',
      'reviewedBy',
    ])
      expect(result).not.toHaveProperty(field);
  });

  it('does not infer events from status, requests, deadlines, blockers or unfinished replacement tasks', async () => {
    record = {
      ...record,
      reviewedAt: undefined,
      assignedAt: undefined,
      closedAt: undefined,
      reassignmentHistory: [],
    };
    history = [
      {
        _id: new Types.ObjectId(),
        assignedAt: at(3),
        completedAt: at(6),
        continuationHistory: [{ at: at(4) }],
      },
    ];
    expect(await service.findOne(String(id), actor)).toHaveProperty(
      'customerHistory',
      [{ type: 'REPORTED', at: at(1).toISOString() }],
    );
  });

  it('retains persisted assignment without task history and omits missing or invalid event times', async () => {
    history = [
      {
        _id: taskId,
        status: 'COMPLETED',
        completedAt: new Date(NaN),
        continuationHistory: [{}, { at: 'not a date' }],
      },
    ];
    record.reassignmentHistory = [{ completedAt: 'not a date' }];
    record.closedAt = undefined;
    expect(await service.findOne(String(id), actor)).toHaveProperty(
      'customerHistory',
      [
        { type: 'REPORTED', at: at(1).toISOString() },
        { type: 'REVIEWED', at: at(2).toISOString() },
        { type: 'ASSIGNED', at: at(5).toISOString() },
      ],
    );
  });

  it.each([null, 'invalid', 42, true, []])(
    'ignores malformed reassignment members %j while preserving safe events',
    async (entry) => {
      record.reassignmentHistory.unshift(entry);
      const result = await service.findOne(String(id), actor);
      expect(result.customerHistory).toEqual([
        { type: 'REPORTED', at: at(1).toISOString() },
        { type: 'REVIEWED', at: at(2).toISOString() },
        { type: 'ASSIGNED', at: at(3).toISOString() },
        { type: 'CONTINUED', at: at(4).toISOString() },
        { type: 'REASSIGNED', at: at(5).toISOString() },
        { type: 'TASK_COMPLETED', at: at(6).toISOString() },
        { type: 'CLOSED', at: at(7).toISOString() },
      ]);
      expect(JSON.stringify(result)).not.toContain('private');
    },
  );

  it.each([null, 'invalid', 42, true, []])(
    'ignores malformed continuation members %j while preserving safe events',
    async (entry) => {
      history[1].continuationHistory.unshift(entry);
      const result = await service.findOne(String(id), actor);
      expect(result.customerHistory).toEqual([
        { type: 'REPORTED', at: at(1).toISOString() },
        { type: 'REVIEWED', at: at(2).toISOString() },
        { type: 'ASSIGNED', at: at(3).toISOString() },
        { type: 'CONTINUED', at: at(4).toISOString() },
        { type: 'REASSIGNED', at: at(5).toISOString() },
        { type: 'TASK_COMPLETED', at: at(6).toISOString() },
        { type: 'CLOSED', at: at(7).toISOString() },
      ]);
      expect(JSON.stringify(result)).not.toContain('private');
    },
  );

  it.each(['invalid', 42, {}])(
    'ignores wrong-shaped reassignment histories %j without suppressing assignment',
    async (value) => {
      record.reassignmentHistory = value;
      const result = await service.findOne(String(id), actor);
      expect(result.customerHistory).toEqual([
        { type: 'REPORTED', at: at(1).toISOString() },
        { type: 'REVIEWED', at: at(2).toISOString() },
        { type: 'ASSIGNED', at: at(5).toISOString() },
        { type: 'TASK_COMPLETED', at: at(6).toISOString() },
        { type: 'CLOSED', at: at(7).toISOString() },
      ]);
    },
  );

  it.each(['invalid', 42, {}])(
    'ignores wrong-shaped continuation histories %j',
    async (value) => {
      history[1].continuationHistory = value;
      const result = await service.findOne(String(id), actor);
      expect(result.customerHistory).toEqual([
        { type: 'REPORTED', at: at(1).toISOString() },
        { type: 'REVIEWED', at: at(2).toISOString() },
        { type: 'ASSIGNED', at: at(3).toISOString() },
        { type: 'REASSIGNED', at: at(5).toISOString() },
        { type: 'TASK_COMPLETED', at: at(6).toISOString() },
        { type: 'CLOSED', at: at(7).toISOString() },
      ]);
    },
  );

  it.each([null, undefined, 'invalid', new Date(NaN)])(
    'does not finalize replacement linkage for invalid completedAt %j',
    async (completedAt) => {
      record.reassignmentHistory[0].completedAt = completedAt;
      history[0].continuationHistory = [{ at: null }, { at: 'invalid' }];
      const result = await service.findOne(String(id), actor);
      expect(result.customerHistory).toEqual([
        { type: 'REPORTED', at: at(1).toISOString() },
        { type: 'REVIEWED', at: at(2).toISOString() },
        { type: 'ASSIGNED', at: at(5).toISOString() },
        { type: 'TASK_COMPLETED', at: at(6).toISOString() },
        { type: 'CLOSED', at: at(7).toISOString() },
      ]);
    },
  );

  it.each(['taskId', 'targetTaskId'])(
    'does not emit reassignment or suppress assignment with missing %s',
    async (field) => {
      delete record.reassignmentHistory[0][field];
      const result = await service.findOne(String(id), actor);
      expect(result.customerHistory).toEqual([
        { type: 'REPORTED', at: at(1).toISOString() },
        { type: 'REVIEWED', at: at(2).toISOString() },
        { type: 'ASSIGNED', at: at(5).toISOString() },
        { type: 'TASK_COMPLETED', at: at(6).toISOString() },
        { type: 'CLOSED', at: at(7).toISOString() },
      ]);
    },
  );

  it('projects a no-action conclusion without inventing task or closure events', async () => {
    record = {
      ...record,
      status: 'CONCLUDED',
      linkedTask: undefined,
      assignedAt: undefined,
      closedAt: undefined,
      reassignmentHistory: [],
      concludedAt: at(2),
    };
    expect(await service.findOne(String(id), actor)).toHaveProperty(
      'customerHistory',
      [
        { type: 'REPORTED', at: at(1).toISOString() },
        { type: 'REVIEWED', at: at(2).toISOString() },
      ],
    );
    expect(tasks.issueTaskHistory).not.toHaveBeenCalled();
  });

  it('keeps the same sanitized history for staff-origin historical issues without changing ownership scope', async () => {
    record.sourceTask = new Types.ObjectId();
    const result = await service.findOne(String(id), actor);
    expect(result.customerHistory).toHaveLength(7);
    expect(issues.findOne).toHaveBeenCalledWith({
      _id: id,
      $or: [
        {
          reporter: new Types.ObjectId(actor.id),
          sourceTask: { $exists: false },
        },
        { booking: { $in: [] }, sourceTask: { $exists: true } },
      ],
    });
  });

  it('does not mutate persisted issue or task records while projecting history', async () => {
    const beforeIssue = structuredClone(record);
    const beforeTasks = structuredClone(history);
    await service.findOne(String(id), actor);
    expect(record).toEqual(beforeIssue);
    expect(history).toEqual(beforeTasks);
  });

  it('denies foreign detail before querying internal task history', async () => {
    issues.findOne.mockReturnValueOnce(query(null));
    await expect(service.findOne(String(id), actor)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(tasks.issueTaskHistory).not.toHaveBeenCalled();
  });
});

describe('Issue read authorization', () => {
  const owner = new Types.ObjectId();
  const booking = new Types.ObjectId();
  const issues = {
    find: vi.fn(() => query([])),
    countDocuments: vi.fn(async () => 0),
  };
  const bookings = { find: vi.fn(() => query([{ _id: booking }])) };
  const service = new IssuesService(
    issues as unknown as Model<Issue>,
    {} as IssueContextAdapter,
    bookings as unknown as Model<Booking>,
    {} as Model<User>,
    {} as TasksService,
  );
  const actor = {
    id: String(owner),
    email: 'owner@example.test',
    role: 'CUSTOMER',
  };
  beforeEach(() => vi.clearAllMocks());
  it('scopes self reports independently and staff reports by current active ownership', async () => {
    await service.list(new ListIssuesQuery(), actor);
    expect(issues.find).toHaveBeenCalledWith({
      $or: [
        { reporter: owner, sourceTask: { $exists: false } },
        { booking: { $in: [booking] }, sourceTask: { $exists: true } },
      ],
    });
  });
  it.each([
    'SERVICE_STAFF',
    'OPERATIONS_STAFF',
    'CUSTOM_MANAGER',
    'manager',
    '',
  ])('denies role %s', async (role) => {
    await expect(
      service.list(new ListIssuesQuery(), { ...actor, role }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(bookings.find).not.toHaveBeenCalled();
  });
  it('rejects an invalid identity', async () => {
    await expect(
      service.list(new ListIssuesQuery(), { ...actor, id: 'bad' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
