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
