import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Types } from 'mongoose';
import { Role } from '../../common/constants/role.enum.js';
import { TaskQueueFilters, TaskQueueListQuery } from './dto/task-queues.dto.js';
import {
  TaskSupervisionService,
  taskSupervisionScope,
  taskOverdueExpression,
} from './task-supervision.service.js';
import { TaskSchema } from '../tasks/schemas/task.schema.js';

describe('UC55 query contracts and live read-only service', () => {
  it('accepts arbitrary exact priority strings, trims and transforms pagination/false', async () => {
    const query = plainToInstance(TaskQueueListQuery, {
      priority: ' RUSH.*[x] ',
      page: '2',
      limit: '20',
      overdue: 'false',
    });
    expect(await validate(query)).toEqual([]);
    expect(query).toMatchObject({
      priority: 'RUSH.*[x]',
      page: 2,
      limit: 20,
      overdue: false,
      sortBy: 'dueAt',
      sortOrder: 'asc',
    });
  });
  it.each([
    { priority: '' },
    { priority: ' ' },
    { priority: 9 },
    { priority: null },
    { priority: 'x'.repeat(101) },
    { page: 0 },
    { limit: 1000 },
    { overdue: '1' },
    { overdue: null },
    { status: 'PENDING' },
    { sourceType: 'OTHER' },
    { assigneeId: 'bad' },
    { sortBy: 'priority' },
    { sortBy: 'title' },
    { sortOrder: 'other' },
    { q: 'x'.repeat(101) },
    { taskType: ' ' },
  ])('rejects list query %j', async (input) => {
    expect(
      (await validate(plainToInstance(TaskQueueListQuery, input))).length,
    ).toBeGreaterThan(0);
  });
  it('forbids status/overdue and unknown fields in summary', async () => {
    for (const input of [
      { status: 'ASSIGNED' },
      { overdue: true },
      { unknown: true },
    ])
      expect(
        await validate(plainToInstance(TaskQueueFilters, input), {
          whitelist: true,
          forbidNonWhitelisted: true,
        }),
      ).not.toEqual([]);
  });
  it('retains the existing authoritative indexes without adding a schema or counter', () => {
    expect(taskSupervisionScope()).toEqual({});
    expect(TaskSchema.indexes().map(([fields]) => fields)).toEqual([
      { assignedTo: 1, status: 1 },
      { status: 1 },
      { sourceType: 1, sourceId: 1 },
      { sourceType: 1, sourceId: 1, taskType: 1 },
    ]);
    expect(TaskSchema.path('priority').instance).toBe('String');
    for (const field of ['counts', 'overdue', 'workload', 'sortNull'])
      expect(TaskSchema.path(field)).toBeUndefined();
  });
  it('does fresh aggregations, passes one clock instant per request and maps assigneeId correctly', async () => {
    const now = new Date('2027-02-01T03:00:00Z');
    const clock = { now: vi.fn(() => now) };
    const aggregate = vi.fn().mockReturnValue({
      exec: async () => [
        {
          metrics: [],
          workload: [],
          taskTypes: [],
          priorities: [],
          items: [],
          count: [],
        },
      ],
    });
    const service = new TaskSupervisionService(
      { aggregate } as never,
      { collection: { name: 'maintenances' } } as never,
      clock,
    );
    const actor = {
      id: String(new Types.ObjectId()),
      email: 'manager@example.test',
      role: Role.Manager,
    };
    const assigneeId = String(new Types.ObjectId());
    const filter = plainToInstance(TaskQueueFilters, {
      priority: 'RUSH.*[x]',
      assigneeId,
      q: '[x].*',
    });
    expect(await service.summary(filter, actor)).toMatchObject({
      counts: { assigned: 0, inProgress: 0, completed: 0, other: 0, total: 0 },
      generatedAt: now.toISOString(),
      facets: { priorities: [], taskTypes: [] },
    });
    await service.summary(filter, actor);
    await service.list(
      plainToInstance(TaskQueueListQuery, { ...filter, overdue: false }),
      actor,
    );
    aggregate.mockReturnValueOnce({ exec: async () => [] });
    await expect(
      service.detail(String(new Types.ObjectId()), actor),
    ).rejects.toMatchObject({ status: 404 });
    expect(aggregate).toHaveBeenCalledTimes(4);
    expect(clock.now).toHaveBeenCalledTimes(4);
    for (const [pipeline] of aggregate.mock.calls) {
      expect(pipeline[0]).toEqual({ $match: taskSupervisionScope() });
      expect(pipeline).toContainEqual({
        $set: { overdue: taskOverdueExpression(now) },
      });
    }
    const facet = aggregate.mock.calls[0][0].find((s: any) => s.$facet).$facet;
    expect(facet.metrics[0].$match).toMatchObject({
      priority: 'RUSH.*[x]',
      assignedTo: new Types.ObjectId(assigneeId),
    });
    expect(facet.metrics[0].$match.title).toEqual({
      $regex: '\\[x\\]\\.\\*',
      $options: 'i',
    });
    await expect(
      service.summary(filter, { ...actor, role: Role.OperationsStaff }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(service.detail('bad', actor)).rejects.toMatchObject({
      status: 400,
    });
    expect(aggregate).toHaveBeenCalledTimes(4);
  });
});
