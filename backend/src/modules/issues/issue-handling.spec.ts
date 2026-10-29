import { Model, Types } from 'mongoose';
import { IssuesService } from './issues.service.js';
import { IssueContextAdapter } from './issue-context.adapter.js';
import {
  Issue,
  HandlingCategory,
  IssuePriority,
  IssueStatus,
} from './schemas/issue.schema.js';
import { Booking } from '../bookings/schemas/booking.schema.js';
import { User } from '../users/schemas/user.schema.js';
import { TasksService } from '../tasks/tasks.service.js';

const chain = (value: unknown) => {
  const query = {
    lean: async () => value,
    select: () => query,
    sort: () => query,
  };
  return query;
};

describe('Issue review and durable assignment', () => {
  const id = new Types.ObjectId();
  const assignee = new Types.ObjectId();
  const actor = {
    id: String(new Types.ObjectId()),
    role: 'RECEPTIONIST',
    email: 'staff@example.test',
  };
  let issue: Record<string, any>;
  let savedTask: Record<string, any> | null;
  let failFinish: boolean;
  let failCreate: boolean;
  const users = {
    findOne: vi.fn(() => chain({ _id: assignee })),
    find: vi.fn(() =>
      chain([
        {
          _id: assignee,
          fullName: 'Staff Name',
          role: 'SERVICE_STAFF',
          email: 'private',
        },
      ]),
    ),
  };
  const issues = {
    findById: vi.fn(() => chain({ ...issue })),
    findOne: vi.fn(() => chain({ ...issue })),
    findOneAndUpdate: vi.fn((filter: any, update: any) => {
      if (filter.status !== issue.status)
        return Object.assign(Promise.resolve(null), chain(null));
      if (update.$set.status === IssueStatus.Assigned && failFinish)
        throw new Error('write unavailable');
      Object.assign(issue, update.$set);
      return Object.assign(Promise.resolve({ ...issue }), chain({ ...issue }));
    }),
  };
  const tasks = {
    findIssueResolutionWork: vi.fn(async () => savedTask),
    issueTask: vi.fn(async () => savedTask),
    issueTaskHistory: vi.fn(async () => (savedTask ? [savedTask] : [])),
    create: vi.fn(async (dto: any, identity: Types.ObjectId) => {
      if (failCreate) throw new Error('task unavailable');
      savedTask ??= {
        ...dto,
        _id: identity,
        assignedTo: assignee,
        assignedAt: new Date(),
        status: 'ASSIGNED',
        ...(dto.dueAt ? { dueAt: new Date(dto.dueAt) } : {}),
      };
      return savedTask;
    }),
  };
  const service = new IssuesService(
    issues as unknown as Model<Issue>,
    {} as IssueContextAdapter,
    {} as Model<Booking>,
    users as unknown as Model<User>,
    tasks as unknown as TasksService,
  );
  const review = {
    handlingCategory: HandlingCategory.Service,
    priority: IssuePriority.High,
    needsStaffAction: true,
    notes: ' Private note ',
  };
  const assignment = {
    assigneeId: String(assignee),
    dueAt: '2030-01-01T12:00:00.000Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    issue = {
      _id: id,
      title: 'Lamp',
      category: 'Lighting',
      description: 'Broken',
      booking: new Types.ObjectId(),
      reportedAt: new Date(),
      status: IssueStatus.PendingReview,
      priority: IssuePriority.Normal,
    };
    savedTask = null;
    failFinish = false;
    failCreate = false;
    users.findOne.mockImplementation(() => chain({ _id: assignee }));
  });

  it.each(['RECEPTIONIST', 'MANAGER'])(
    'closes concluded work once as %s with immutable audit',
    async (role) => {
      await service.review(
        String(id),
        { ...review, needsStaffAction: false },
        actor,
      );
      const result = await service.close(
        String(id),
        { conclusion: ' Resolved privately ' },
        { ...actor, role },
      );
      expect(result).toMatchObject({
        status: 'CLOSED',
        closedBy: actor.id,
        closureConclusion: 'Resolved privately',
        reviewNotes: 'Private note',
      });
      expect(result.closedAt).toBeDefined();
      const audit = { ...issue };
      await expect(
        service.close(String(id), { conclusion: 'Overwrite' }, actor),
      ).rejects.toThrow();
      expect(issue).toEqual(audit);
      expect(tasks.create).not.toHaveBeenCalled();
    },
  );

  it.each([
    'CUSTOMER',
    'SERVICE_STAFF',
    'OPERATIONS_STAFF',
    'CUSTOM_ROLE',
    'manager',
  ])('denies closing service role %s', async (role) => {
    await expect(
      service.close(String(id), { conclusion: 'Done' }, { ...actor, role }),
    ).rejects.toThrow();
    expect(issues.findById).not.toHaveBeenCalled();
  });

  it.each([
    {},
    { conclusion: '' },
    { conclusion: '   ' },
    { conclusion: null },
    { conclusion: 1 },
    { conclusion: 'x'.repeat(2001) },
    { conclusion: 'Done', status: 'COMPLETED' },
    { conclusion: 'Done', closedBy: actor.id },
  ])('rejects closing input %j', async (input) => {
    await expect(
      service.close(String(id), input as any, actor),
    ).rejects.toThrow('Invalid input');
    expect(issues.findById).not.toHaveBeenCalled();
  });

  const completed = async () => {
    await service.review(String(id), review, actor);
    await service.assign(String(id), assignment, actor);
    Object.assign(savedTask!, {
      sourceType: 'ISSUE',
      sourceId: id,
      status: 'COMPLETED',
      completedAt: new Date(),
      workResult: 'Repaired',
    });
  };

  it('requires persisted exact completed source work and never writes tasks', async () => {
    await completed();
    tasks.create.mockClear();
    const result = await service.close(
      String(id),
      { conclusion: 'Confirmed repaired' },
      actor,
    );
    expect(result.status).toBe('CLOSED');
    expect(result.linkedTasks[0].status).toBe('COMPLETED');
    expect(tasks.create).not.toHaveBeenCalled();
  });

  it.each([
    { status: 'ASSIGNED' },
    { status: 'IN_PROGRESS' },
    { completedAt: undefined },
    { completedAt: new Date(NaN) },
    { workResult: undefined },
    { workResult: ' ' },
    { workResult: 'x'.repeat(2001) },
    { sourceType: 'SERVICE_ORDER' },
    { sourceId: new Types.ObjectId() },
    { taskType: 'OTHER' },
    { _id: new Types.ObjectId() },
  ])('rejects invalid linked task %j', async (change) => {
    await completed();
    Object.assign(savedTask!, change);
    await expect(
      service.close(String(id), { conclusion: 'Done' }, actor),
    ).rejects.toThrow();
    expect(issue.closedAt).toBeUndefined();
  });

  it('rejects missing linked work and incomplete review metadata', async () => {
    await completed();
    savedTask = null;
    await expect(
      service.close(String(id), { conclusion: 'Done' }, actor),
    ).rejects.toThrow();
    delete issue.linkedTask;
    await expect(
      service.close(String(id), { conclusion: 'Done' }, actor),
    ).rejects.toThrow();
    issue.status = IssueStatus.Concluded;
    issue.needsStaffAction = false;
    issue.concludedAt = new Date();
    delete issue.reviewedBy;
    await expect(
      service.close(String(id), { conclusion: 'Done' }, actor),
    ).rejects.toThrow();
  });

  it('rejects stale CAS and races with exactly one winner', async () => {
    await service.review(
      String(id),
      { ...review, needsStaffAction: false },
      actor,
    );
    issues.findOneAndUpdate.mockImplementationOnce(() =>
      Object.assign(Promise.resolve(null), chain(null)),
    );
    await expect(
      service.close(String(id), { conclusion: 'Done' }, actor),
    ).rejects.toThrow('Issue changed');
    const calls = await Promise.allSettled([
      service.close(String(id), { conclusion: 'First' }, actor),
      service.close(String(id), { conclusion: 'Second' }, actor),
    ]);
    expect(calls.filter((call) => call.status === 'fulfilled')).toHaveLength(1);
    expect(issues.findOneAndUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        status: 'CONCLUDED',
        needsStaffAction: false,
        linkedTask: { $exists: false },
        reviewedBy: expect.any(Types.ObjectId),
        reviewedAt: expect.any(Date),
        concludedAt: expect.any(Date),
      }),
      expect.anything(),
      { new: true, runValidators: true },
    );
  });

  it('reviews once atomically, preserves reporting category and records audit', async () => {
    const result = await service.review(String(id), review, actor);
    expect(result).toMatchObject({
      status: 'REVIEWED',
      category: 'Lighting',
      handlingCategory: 'SERVICE',
      priority: 'HIGH',
      reviewedBy: actor.id,
      reviewNotes: 'Private note',
      needsStaffAction: true,
    });
    expect(result.reviewedAt).toBeDefined();
    await expect(service.review(String(id), review, actor)).rejects.toThrow(
      'no longer pending',
    );
  });

  it('concludes without closing or creating a task', async () => {
    const result = await service.review(
      String(id),
      { ...review, needsStaffAction: false },
      actor,
    );
    expect(result.status).toBe('CONCLUDED');
    expect(result.concludedAt).toBeDefined();
    expect(result.closedAt).toBeUndefined();
    await expect(service.assign(String(id), assignment, actor)).rejects.toThrow(
      'not eligible',
    );
    expect(tasks.create).not.toHaveBeenCalled();
  });

  it.each([
    'CUSTOMER',
    'MANAGER',
    'SERVICE_STAFF',
    'OPERATIONS_STAFF',
    'CUSTOM_ROLE',
  ])('rejects service caller %s before querying', async (role) => {
    for (const call of [
      () => service.review(String(id), review, { ...actor, role }),
      () => service.assign(String(id), assignment, { ...actor, role }),
      () => service.assignees(String(id), { ...actor, role }),
    ])
      await expect(call()).rejects.toThrow();
    expect(issues.findById).not.toHaveBeenCalled();
  });

  it.each(['', '   ', null, 3, 'x'.repeat(2001)])(
    'rejects invalid initial instructions %j before writes',
    async (instructions) => {
      await expect(
        service.assign(
          String(id),
          { ...assignment, instructions } as any,
          actor,
        ),
      ).rejects.toThrow('Invalid input');
      expect(issues.findOneAndUpdate).not.toHaveBeenCalled();
      expect(tasks.create).not.toHaveBeenCalled();
    },
  );

  it('freezes trimmed instructions across failed linkage and retries', async () => {
    await service.review(String(id), review, actor);
    failFinish = true;
    const input = { ...assignment, instructions: '  Check wiring  ' };
    await expect(service.assign(String(id), input, actor)).rejects.toThrow();
    expect(issue.assignmentInstructions).toBe('Check wiring');
    expect(savedTask!.instructions).toBe('Check wiring');
    const writes = issues.findOneAndUpdate.mock.calls.length;
    for (const instructions of [undefined, 'Different']) {
      await expect(
        service.assign(String(id), { ...assignment, instructions }, actor),
      ).rejects.toThrow('different assignment intent');
    }
    expect(issues.findOneAndUpdate).toHaveBeenCalledTimes(writes);
    failFinish = false;
    const result = await service.assign(String(id), input, actor);
    expect(result.assignmentInstructions).toBe('Check wiring');
    expect(tasks.create).toHaveBeenCalledTimes(1);
  });

  it('rejects existing task with mismatched instructions without finalizing', async () => {
    await service.review(String(id), review, actor);
    failFinish = true;
    const input = { ...assignment, instructions: 'Check wiring' };
    await expect(service.assign(String(id), input, actor)).rejects.toThrow();
    savedTask!.instructions = 'Different';
    failFinish = false;
    issues.findOneAndUpdate.mockClear();
    await expect(service.assign(String(id), input, actor)).rejects.toThrow(
      'does not match',
    );
    expect(issues.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('uses active routing role and exposes names only', async () => {
    await service.review(String(id), review, actor);
    expect(await service.assignees(String(id), actor)).toEqual({
      items: [
        {
          id: String(assignee),
          displayName: 'Staff Name',
          role: 'SERVICE_STAFF',
        },
      ],
    });
    expect(users.find).toHaveBeenCalledWith({
      isActive: true,
      role: 'SERVICE_STAFF',
    });
    users.findOne.mockImplementation(() => chain(null));
    await expect(service.assign(String(id), assignment, actor)).rejects.toThrow(
      'active staff',
    );
    expect(issue.status).toBe('REVIEWED');
    expect(tasks.create).not.toHaveBeenCalled();
  });

  it('recovers task write and completed work after finalization failure without creating again', async () => {
    await service.review(String(id), review, actor);
    failFinish = true;
    await expect(service.assign(String(id), assignment, actor)).rejects.toThrow(
      'write unavailable',
    );
    expect(issue.status).toBe('ASSIGNING');
    savedTask!.status = 'COMPLETED';
    savedTask!.workResult = 'Private result';
    savedTask!.completedAt = new Date();
    failFinish = false;
    const result = await service.assign(String(id), assignment, actor);
    expect(tasks.create).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('ASSIGNED');
    expect(result.linkedTasks[0].status).toBe('COMPLETED');
    expect(result.linkedTasks[0]).not.toHaveProperty('workResult');
    expect(result.closedAt).toBeUndefined();
    await expect(service.assign(String(id), assignment, actor)).rejects.toThrow(
      'not eligible',
    );
  });

  it('keeps durable intent after task failure and rejects a different retry', async () => {
    await service.review(String(id), review, actor);
    failCreate = true;
    await expect(service.assign(String(id), assignment, actor)).rejects.toThrow(
      'task unavailable',
    );
    const identity = String(issue.assignmentTaskId);
    expect(issue.status).toBe('ASSIGNING');
    await expect(
      service.assign(
        String(id),
        { ...assignment, dueAt: '2031-01-01T12:00:00Z' },
        actor,
      ),
    ).rejects.toThrow('different assignment');
    failCreate = false;
    await service.assign(String(id), assignment, actor);
    expect(String(savedTask!._id)).toBe(identity);
  });

  it('rejects mismatched preexisting source work', async () => {
    await service.review(String(id), review, actor);
    savedTask = { _id: new Types.ObjectId(), assignedTo: assignee };
    await expect(service.assign(String(id), assignment, actor)).rejects.toThrow(
      'does not match',
    );
    expect(issue.status).toBe('ASSIGNING');
    expect(tasks.create).not.toHaveBeenCalled();
  });

  it.each([
    { ...assignment, dueAt: null },
    { ...assignment, dueAt: 'invalid' },
    { assigneeId: 'invalid' },
    { ...assignment, extra: true },
  ])('rejects invalid assignment %j', async (input) => {
    await expect(
      service.assign(String(id), input as any, actor),
    ).rejects.toThrow('Invalid input');
    expect(issues.findById).not.toHaveBeenCalled();
  });
});
