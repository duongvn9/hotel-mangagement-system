import { Connection, Model, Types } from 'mongoose';
import { TasksService } from './tasks.service.js';
import { Task } from './schemas/task.schema.js';
import { User } from '../users/schemas/user.schema.js';
import { Role } from '../roles/schemas/role.schema.js';
import { TaskSourceType, TaskStatus } from './task-contract.js';

const lean = (value: unknown) => ({
  lean: async () => value,
  select: () => lean(value),
});

describe('Issue resolution task safety', () => {
  const id = String(new Types.ObjectId());
  const actor = String(new Types.ObjectId());
  const issueId = String(new Types.ObjectId());
  let task: any;
  let canonical: boolean;
  let loseCAS: boolean;
  const tasks = {
    findById: vi.fn(() => lean(task)),
    findOne: vi.fn(() => lean(task)),
    findOneAndUpdate: vi.fn(async (filter: any, update: any) => {
      if (
        loseCAS ||
        filter.status !== task.status ||
        (typeof filter.revision === 'number' &&
          filter.revision !== task.revision)
      )
        return null;
      Object.assign(task, update.$set);
      if (update.$inc) task.revision = (task.revision ?? 0) + 1;
      for (const [key, value] of Object.entries(update.$push ?? {}))
        (task[key] ??= []).push(value);
      return task;
    }),
    collection: { createIndex: vi.fn(async () => 'index') },
  };
  const users = {
    findById: vi.fn(() => lean({ role: 'SERVICE_STAFF', isActive: true })),
  };
  const findOne = vi.fn(async () =>
    canonical ? { _id: new Types.ObjectId(issueId) } : null,
  );
  const connection = { collection: vi.fn(() => ({ findOne })) };
  const service = new TasksService(
    tasks as unknown as Model<Task>,
    users as unknown as Model<User>,
    {} as Model<Role>,
    connection as unknown as Connection,
  );
  beforeEach(() => {
    vi.clearAllMocks();
    canonical = true;
    loseCAS = false;
    task = {
      _id: new Types.ObjectId(id),
      title: 'Lamp',
      taskType: 'ISSUE_RESOLUTION',
      priority: 'NORMAL',
      assignedTo: new Types.ObjectId(actor),
      assignedAt: new Date(),
      status: TaskStatus.Assigned,
      sourceType: TaskSourceType.Issue,
      sourceId: new Types.ObjectId(issueId),
      revision: 0,
      blockerHistory: [],
    };
  });

  it.each([TaskStatus.Assigned, TaskStatus.InProgress])(
    'reports inability at %s without progress changes',
    async (status) => {
      task.status = status;
      await service.reportUnable(actor, id, { reason: ' Missing part ' });
      expect(task.status).toBe(status);
      expect(task.blocked).toBe(true);
      expect(task.blockerHistory[0]).toMatchObject({
        reason: 'Missing part',
        reportedBy: actor,
      });
      await service.reportUnable(actor, id, { reason: 'Still missing' });
      expect(task.blockerHistory).toHaveLength(2);
    },
  );

  it.each([TaskStatus.Completed, TaskStatus.Cancelled])(
    'rejects inability at terminal %s',
    async (status) => {
      task.status = status;
      await expect(
        service.reportUnable(actor, id, { reason: 'No' }),
      ).rejects.toThrow('not active');
      expect(tasks.findOneAndUpdate).not.toHaveBeenCalled();
    },
  );

  it.each([TaskSourceType.ServiceOrder, TaskSourceType.Maintenance])(
    'cannot block unrelated %s work',
    async (sourceType) => {
      task.sourceType = sourceType;
      await expect(
        service.reportUnable(actor, id, { reason: 'No' }),
      ).rejects.toThrow('Not issue');
      expect(tasks.findOneAndUpdate).not.toHaveBeenCalled();
    },
  );

  it.each(['', ' ', null, 3, 'x'.repeat(2001)])(
    'rejects invalid reason %j',
    async (reason) => {
      await expect(
        service.reportUnable(actor, id, { reason } as any),
      ).rejects.toThrow('Invalid reason');
      expect(tasks.findOneAndUpdate).not.toHaveBeenCalled();
    },
  );

  it('requires exact linked ASSIGNED issue and no pending intent', async () => {
    canonical = false;
    await expect(
      service.reportUnable(actor, id, { reason: 'No' }),
    ).rejects.toThrow('not finalized');
    await expect(
      service.transitionAssignedTask(
        id,
        actor,
        TaskStatus.Assigned,
        TaskStatus.InProgress,
      ),
    ).rejects.toThrow('not finalized');
    expect(findOne).toHaveBeenCalledWith({
      _id: task.sourceId,
      status: 'ASSIGNED',
      linkedTask: task._id,
      pendingReassignment: { $exists: false },
    });
    expect(tasks.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('blocked completion is refused without changing task', async () => {
    task.status = TaskStatus.InProgress;
    task.blocked = true;
    await expect(
      service.transitionAssignedTask(
        id,
        actor,
        TaskStatus.InProgress,
        TaskStatus.Completed,
        'Done',
      ),
    ).rejects.toThrow('blocked');
    expect(tasks.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('Continue preserves progress/assignee and resolves only outstanding blockers', async () => {
    task.status = TaskStatus.InProgress;
    task.blocked = true;
    const historical = {
      id: 'older',
      reason: 'old',
      resolvedAt: new Date(0),
      resolution: 'CONTINUED',
    };
    task.blockerHistory = [historical, { id: 'current', reason: 'part' }];
    const assignedTo = task.assignedTo;
    await service.continueIssueTask(
      task,
      actor,
      '2030-01-01T00:00:00Z',
      'Use replacement',
    );
    expect(task.status).toBe('IN_PROGRESS');
    expect(task.assignedTo).toBe(assignedTo);
    expect(task.blocked).toBe(false);
    expect(task.instructions).toBe('Use replacement');
    expect(task.blockerHistory[0]).toEqual(historical);
    expect(task.blockerHistory[1]).toMatchObject({
      resolvedBy: actor,
      resolution: 'CONTINUED',
    });
    expect(task.continuationHistory).toHaveLength(1);
  });

  it('Continue requires blocked/overdue active work', async () => {
    await expect(service.continueIssueTask(task, actor)).rejects.toThrow(
      'blocked or overdue',
    );
    task.dueAt = new Date(0);
    await service.continueIssueTask(task, actor);
    expect(task.status).toBe('ASSIGNED');
  });

  it('revision CAS rejects stale Continue and report writes', async () => {
    task.blocked = true;
    loseCAS = true;
    await expect(service.continueIssueTask(task, actor)).rejects.toThrow(
      'changed',
    );
    await expect(
      service.reportUnable(actor, id, { reason: 'No' }),
    ).rejects.toThrow('changed');
  });

  it('cancellation and completion both CAS on active status and revision', async () => {
    task.status = TaskStatus.InProgress;
    task.dueAt = new Date(0);
    const audit = {
      actorId: actor,
      recoveryActorId: actor,
      at: new Date(),
      reason: 'replace',
      requestId: 'request',
    };
    await service.cancelIssueTask(issueId, id, 0, audit);
    expect(task.status).toBe('CANCELLED');
    await expect(
      service.transitionAssignedTask(
        id,
        actor,
        TaskStatus.InProgress,
        TaskStatus.Completed,
        'Done',
      ),
    ).rejects.toThrow();
    expect(tasks.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ status: TaskStatus.InProgress, revision: 0 }),
      expect.objectContaining({
        $set: expect.objectContaining({ status: TaskStatus.Cancelled }),
      }),
      expect.anything(),
    );
    await service.cancelIssueTask(issueId, id, 0, audit);
  });

  it.each(['continue', 'report'])(
    'paused %s loses CAS when cancellation wins first',
    async (operation) => {
      task.blocked = true;
      const original = tasks.findOneAndUpdate.getMockImplementation()!;
      let release!: () => void;
      let reached!: () => void;
      const paused = new Promise<void>((resolve) => {
        reached = resolve;
      });
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      tasks.findOneAndUpdate.mockImplementationOnce(async (filter, update) => {
        reached();
        await gate;
        return original(filter, update);
      });
      const pending =
        operation === 'continue'
          ? service.continueIssueTask({ ...task }, actor)
          : service.reportUnable(actor, id, { reason: 'New blocker' });
      await paused;
      await service.cancelIssueTask(issueId, id, 0, {
        actorId: actor,
        recoveryActorId: actor,
        at: new Date(),
        reason: 'replace',
        requestId: 'request',
      });
      release();
      await expect(pending).rejects.toThrow('changed');
      expect(task.status).toBe(TaskStatus.Cancelled);
      expect(task.continuationHistory).toBeUndefined();
      expect(task.blockerHistory).toHaveLength(0);
    },
  );

  it.each(['continue', 'report'])(
    'paused cancellation refuses revision advanced by %s',
    async (operation) => {
      task.blocked = true;
      const original = tasks.findOneAndUpdate.getMockImplementation()!;
      let release!: () => void;
      let reached!: () => void;
      const paused = new Promise<void>((resolve) => {
        reached = resolve;
      });
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      tasks.findOneAndUpdate.mockImplementationOnce(async (filter, update) => {
        reached();
        await gate;
        return original(filter, update);
      });
      const pending = service.cancelIssueTask(issueId, id, 0, {
        actorId: actor,
        recoveryActorId: actor,
        at: new Date(),
        reason: 'replace',
        requestId: 'request',
      });
      await paused;
      if (operation === 'continue')
        await service.continueIssueTask({ ...task }, actor);
      else await service.reportUnable(actor, id, { reason: 'New blocker' });
      release();
      await expect(pending).rejects.toThrow('changed');
      expect(task.status).toBe(TaskStatus.Assigned);
      await expect(
        service.cancelIssueTask(issueId, id, 0, {
          actorId: actor,
          recoveryActorId: actor,
          at: new Date(),
          reason: 'replace',
          requestId: 'request',
        }),
      ).rejects.toThrow('changed');
    },
  );

  it('completed task cannot be cancelled', async () => {
    task.status = TaskStatus.Completed;
    await expect(
      service.cancelIssueTask(issueId, id, 0, {
        actorId: actor,
        recoveryActorId: actor,
        at: new Date(),
        reason: 'replace',
        requestId: 'request',
      }),
    ).rejects.toThrow('changed');
    expect(tasks.findOneAndUpdate).not.toHaveBeenCalled();
  });
});
