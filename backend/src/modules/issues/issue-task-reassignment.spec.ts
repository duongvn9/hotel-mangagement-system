import { Model, Types } from 'mongoose';
import { IssuesService } from './issues.service.js';
import { IssueContextAdapter } from './issue-context.adapter.js';
import {
  Issue,
  IssueStatus,
  HandlingCategory,
} from './schemas/issue.schema.js';
import { Booking } from '../bookings/schemas/booking.schema.js';
import { User } from '../users/schemas/user.schema.js';
import { TasksService } from '../tasks/tasks.service.js';
import { TaskSourceType, TaskStatus } from '../tasks/task-contract.js';

const query = (value: unknown) =>
  Object.assign(Promise.resolve(value), { lean: async () => value });

describe('Issue resolution reassignment recovery', () => {
  const id = String(new Types.ObjectId());
  const oldId = String(new Types.ObjectId());
  const oldStaff = String(new Types.ObjectId());
  const newStaff = String(new Types.ObjectId());
  const thirdStaff = String(new Types.ObjectId());
  const actor = {
    id: String(new Types.ObjectId()),
    role: 'RECEPTIONIST',
    email: 'r@example.test',
  };
  const recovery = { ...actor, id: String(new Types.ObjectId()) };
  const input = {
    taskId: oldId,
    assigneeId: newStaff,
    reason: 'Requires another specialist',
    requestId: 'stable-request',
  };
  let issue: any;
  let records: Map<string, any>;
  let inactive: Set<string>;
  let failCreate: boolean;
  let failLink: boolean;
  let failCancel: boolean;
  const model = {
    findById: vi.fn(() => query(structuredClone(issue))),
    findOneAndUpdate: vi.fn((filter: any, update: any) => {
      if (
        filter['pendingReassignment.targetTaskId'] &&
        filter['pendingReassignment.targetTaskId'] !==
          issue.pendingReassignment?.targetTaskId
      )
        return query(null);
      if (update.$set?.pendingReassignment && issue.pendingReassignment)
        return query(null);
      if (update.$set?.linkedTask && failLink) throw new Error('link failed');
      for (const [key, value] of Object.entries(update.$set ?? {})) {
        if (key.startsWith('pendingReassignment.'))
          issue.pendingReassignment[key.split('.')[1]] = value;
        else issue[key] = value;
      }
      for (const key of Object.keys(update.$unset ?? {})) delete issue[key];
      for (const [key, value] of Object.entries(update.$push ?? {})) {
        if (key.startsWith('pendingReassignment.'))
          issue.pendingReassignment[key.split('.')[1]].push(value);
        else (issue[key] ??= []).push(value);
      }
      return query(structuredClone(issue));
    }),
    updateOne: vi.fn(async (_filter: any, update: any) => {
      if (update.$unset?.pendingReassignment) delete issue.pendingReassignment;
      if (update.$addToSet && issue.pendingReassignment)
        issue.pendingReassignment.recoveryActors.push(
          update.$addToSet['pendingReassignment.recoveryActors'],
        );
    }),
  };
  const users = {
    findOne: vi.fn((filter: any) =>
      query(inactive.has(String(filter._id)) ? null : { _id: filter._id }),
    ),
  };
  const tasks = {
    issueTask: vi.fn(
      async (_id: string, taskId: string) => records.get(taskId) ?? null,
    ),
    actionableIssueTask: vi.fn(
      (task: any) =>
        [TaskStatus.Assigned, TaskStatus.InProgress].includes(task.status) &&
        (task.blocked || task.dueAt < new Date()),
    ),
    cancelIssueTask: vi.fn(
      async (_id: string, taskId: string, _revision: number, audit: any) => {
        if (failCancel) throw new Error('cancel failed');
        const task = records.get(taskId);
        if (task.status === TaskStatus.Completed) throw new Error('completed');
        task.status = TaskStatus.Cancelled;
        task.cancellation = audit;
      },
    ),
    create: vi.fn(async (dto: any, identity: Types.ObjectId) => {
      if (failCreate) throw new Error('create failed');
      const task = {
        ...dto,
        _id: identity,
        assignedTo: new Types.ObjectId(dto.assigneeId),
        assignedAt: new Date(),
        status: TaskStatus.Assigned,
        ...(dto.dueAt ? { dueAt: new Date(dto.dueAt) } : {}),
      };
      records.set(String(identity), task);
      return task;
    }),
    fenceUnusedIssueTarget: vi.fn(async (_id: string, target: string) => {
      if (records.has(target)) throw new Error('target already created');
      records.set(target, { status: TaskStatus.Cancelled });
    }),
    blockUnavailableIssueTarget: vi.fn(async (_id: string, target: string) => {
      records.get(target).blocked = true;
    }),
    continueIssueTask: vi.fn(async () => {}),
  };
  const service = new IssuesService(
    model as unknown as Model<Issue>,
    {} as IssueContextAdapter,
    {} as Model<Booking>,
    users as unknown as Model<User>,
    tasks as unknown as TasksService,
  );

  beforeEach(() => {
    vi.clearAllMocks();
    issue = {
      _id: id,
      title: 'Broken lamp',
      priority: 'HIGH',
      status: IssueStatus.Assigned,
      linkedTask: oldId,
      handlingCategory: HandlingCategory.Service,
      reassignmentHistory: [],
    };
    records = new Map([
      [
        oldId,
        {
          _id: new Types.ObjectId(oldId),
          assignedTo: new Types.ObjectId(oldStaff),
          sourceType: TaskSourceType.Issue,
          taskType: 'ISSUE_RESOLUTION',
          status: TaskStatus.InProgress,
          blocked: true,
          revision: 3,
        },
      ],
    ]);
    inactive = new Set();
    failCreate = false;
    failLink = false;
    failCancel = false;
    vi.spyOn(service, 'findOne').mockImplementation(async () =>
      structuredClone(issue),
    );
  });

  afterEach(() => vi.restoreAllMocks());

  it('reassigns while preserving ASSIGNED, original actor and deterministic target', async () => {
    await service.reassign(id, input, actor);
    expect(issue.status).toBe('ASSIGNED');
    expect(records.get(oldId).status).toBe('CANCELLED');
    expect(records.get(oldId).cancellation).toMatchObject({
      actorId: actor.id,
      recoveryActorId: actor.id,
      reason: input.reason,
    });
    expect(issue.pendingReassignment).toBeUndefined();
    expect(String(issue.linkedTask)).toBe(
      issue.reassignmentHistory[0].targetTaskId,
    );
    expect(tasks.create).toHaveBeenCalledTimes(1);
  });

  it.each(['create', 'link', 'cancel'])(
    'recovers %s failure with another receptionist',
    async (stage) => {
      failCreate = stage === 'create';
      failLink = stage === 'link';
      failCancel = stage === 'cancel';
      await expect(service.reassign(id, input, actor)).rejects.toThrow();
      const intent = structuredClone(issue.pendingReassignment);
      expect(intent.actorId).toBe(actor.id);
      expect(issue.status).toBe('ASSIGNED');
      failCreate = false;
      failLink = false;
      failCancel = false;
      await service.reassign(id, input, recovery);
      expect(String(issue.linkedTask)).toBe(intent.targetTaskId);
      expect(issue.reassignmentHistory[0]).toMatchObject({
        actorId: actor.id,
        recoveryActors: expect.arrayContaining([recovery.id]),
      });
      expect(
        [...records.values()].filter(
          (task) => task.status === TaskStatus.Assigned,
        ),
      ).toHaveLength(1);
    },
  );

  it('replays a completed request without creating or cancelling again', async () => {
    await service.reassign(id, input, actor);
    await service.reassign(id, input, recovery);
    expect(tasks.create).toHaveBeenCalledTimes(1);
    expect(tasks.cancelIssueTask).toHaveBeenCalledTimes(1);
  });

  it.each([
    { reason: 'different' },
    { assigneeId: thirdStaff },
    { taskId: String(new Types.ObjectId()) },
    { dueAt: '2030-01-01T00:00:00Z' },
  ])('rejects changed completed request %j', async (change) => {
    await service.reassign(id, input, actor);
    await expect(
      service.reassign(id, { ...input, ...change }, actor),
    ).rejects.toThrow('different input');
  });

  it('keeps cancellation durable when target becomes inactive and safely replaces unused target', async () => {
    failCreate = true;
    await expect(service.reassign(id, input, actor)).rejects.toThrow();
    const abandoned = issue.pendingReassignment.targetTaskId;
    inactive.add(newStaff);
    failCreate = false;
    await expect(service.reassign(id, input, recovery)).rejects.toThrow(
      'unavailable',
    );
    await service.reassign(id, { ...input, assigneeId: thirdStaff }, recovery);
    expect(tasks.fenceUnusedIssueTarget).toHaveBeenCalledWith(
      id,
      abandoned,
      newStaff,
      input.requestId,
      actor.id,
      recovery.id,
    );
    expect(issue.reassignmentHistory[0].abandonedTargets).toContain(abandoned);
    expect(String(issue.linkedTask)).not.toBe(abandoned);
  });

  it('refuses changing an eligible pending target', async () => {
    failCreate = true;
    await expect(service.reassign(id, input, actor)).rejects.toThrow();
    await expect(
      service.reassign(id, { ...input, assigneeId: thirdStaff }, recovery),
    ).rejects.toThrow('still eligible');
  });

  it('finalizes an already-created inactive target as blocked so a fresh reassignment can recover', async () => {
    failLink = true;
    await expect(service.reassign(id, input, actor)).rejects.toThrow();
    inactive.add(newStaff);
    failLink = false;
    await service.reassign(id, input, recovery);
    expect(tasks.blockUnavailableIssueTarget).toHaveBeenCalled();
    expect(records.get(String(issue.linkedTask)).blocked).toBe(true);
    expect(issue.pendingReassignment).toBeUndefined();
  });

  it('completion wins without cancellation or new work, and clears the abandoned intent', async () => {
    tasks.cancelIssueTask.mockImplementationOnce(async () => {
      records.get(oldId).status = TaskStatus.Completed;
      throw new Error('completed');
    });
    await expect(service.reassign(id, input, actor)).rejects.toThrow(
      'completed',
    );
    expect(issue.pendingReassignment).toBeUndefined();
    expect(tasks.create).not.toHaveBeenCalled();
  });

  it.each(['CUSTOMER', 'MANAGER', 'SERVICE_STAFF', 'OPERATIONS_STAFF'])(
    'denies %s before reads',
    async (role) => {
      await expect(
        service.reassign(id, input, { ...actor, role }),
      ).rejects.toThrow();
      await expect(
        service.continueResolution(id, { taskId: oldId }, { ...actor, role }),
      ).rejects.toThrow();
      expect(model.findById).not.toHaveBeenCalled();
    },
  );

  it('rejects stale task, same assignee, inactive staff and unblocked nonoverdue work', async () => {
    await expect(
      service.reassign(
        id,
        { ...input, taskId: String(new Types.ObjectId()) },
        actor,
      ),
    ).rejects.toThrow();
    await expect(
      service.reassign(id, { ...input, assigneeId: oldStaff }, actor),
    ).rejects.toThrow('different');
    inactive.add(newStaff);
    await expect(service.reassign(id, input, actor)).rejects.toThrow(
      'active staff',
    );
    inactive.clear();
    records.get(oldId).blocked = false;
    await expect(service.reassign(id, input, actor)).rejects.toThrow(
      'blocked or overdue',
    );
  });

  it('accepts overdue unblocked work and preserves optional due date', async () => {
    records.get(oldId).blocked = false;
    records.get(oldId).dueAt = new Date(0);
    await service.reassign(
      id,
      { ...input, dueAt: '2030-01-01T00:00:00.000Z' },
      actor,
    );
    expect(tasks.create).toHaveBeenCalledWith(
      expect.objectContaining({ dueAt: '2030-01-01T00:00:00.000Z' }),
      expect.any(Types.ObjectId),
    );
  });

  it('continues only finalized current work and forwards optional instructions', async () => {
    await service.continueResolution(
      id,
      { taskId: oldId, instructions: 'Try replacement part' },
      actor,
    );
    expect(tasks.continueIssueTask).toHaveBeenCalledWith(
      records.get(oldId),
      actor.id,
      undefined,
      'Try replacement part',
    );
    issue.pendingReassignment = {};
    await expect(
      service.continueResolution(id, { taskId: oldId }, actor),
    ).rejects.toThrow('finalized');
  });

  it.each(['continue', 'report'])(
    'rejects a paused cancellation after successful concurrent %s and clears stale intent',
    async (operation) => {
      const original = tasks.cancelIssueTask.getMockImplementation()!;
      let release!: () => void;
      let reached!: () => void;
      const paused = new Promise<void>((resolve) => {
        reached = resolve;
      });
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      tasks.cancelIssueTask.mockImplementationOnce(async (...args) => {
        reached();
        await gate;
        if ((records.get(oldId).revision ?? 0) !== args[2])
          throw new Error('revision changed');
        return original(...args);
      });
      const pending = service.reassign(id, input, actor);
      await paused;
      const current = records.get(oldId);
      current.revision++;
      if (operation === 'continue') {
        current.blocked = false;
        current.instructions = 'Continue won';
      } else current.blockerHistory = [{ reason: 'New report won' }];
      release();
      await expect(pending).rejects.toThrow('revision changed');
      expect(current.status).toBe(TaskStatus.InProgress);
      expect(issue.pendingReassignment).toBeUndefined();
      expect(tasks.create).not.toHaveBeenCalled();
      current.blocked = true;
      await service.reassign(id, input, recovery);
      expect(issue.pendingReassignment).toBeUndefined();
    },
  );

  it('rejects uppercase same-assignee input before persisting an intent', async () => {
    await expect(
      service.reassign(
        id,
        {
          ...input,
          taskId: oldId.toUpperCase(),
          assigneeId: oldStaff.toUpperCase(),
        },
        actor,
      ),
    ).rejects.toThrow('different assignee');
    expect(model.findOneAndUpdate).not.toHaveBeenCalled();
    expect(tasks.cancelIssueTask).not.toHaveBeenCalled();
  });

  it('refuses uppercase original assignee during inactive-target recovery', async () => {
    failCreate = true;
    await expect(service.reassign(id, input, actor)).rejects.toThrow();
    inactive.add(newStaff);
    await expect(
      service.reassign(
        id,
        { ...input, assigneeId: oldStaff.toUpperCase() },
        recovery,
      ),
    ).rejects.toThrow('different active');
    expect(tasks.fenceUnusedIssueTarget).not.toHaveBeenCalled();
  });

  it('refuses close while any recovery intent is pending', async () => {
    issue.pendingReassignment = {};
    await expect(
      service.close(id, { conclusion: 'done' }, actor),
    ).rejects.toThrow('recovery');
    expect(tasks.issueTask).not.toHaveBeenCalled();
  });
});
