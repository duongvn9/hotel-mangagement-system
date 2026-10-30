import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, type PipelineStage } from 'mongoose';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { Role } from '../../common/constants/role.enum.js';
import {
  Task,
  TaskSourceType,
  TaskStatus,
} from '../tasks/schemas/task.schema.js';
import { Maintenance } from '../maintenance/schemas/maintenance.schema.js';
import { TaskSupervisionClock } from './task-supervision.clock.js';
import {
  TaskQueueFilters,
  TaskQueueListQuery,
  type TaskQueueSummary,
  type SupervisedTaskDetail,
  type SupervisedTask,
} from './dto/task-queues.dto.js';

/** One hotel: current design scope is all tasks. Replace only this expression when scope is agreed. */
export const taskSupervisionScope = (): Record<string, unknown> => ({});

export const taskOverdueExpression = (now: Date) => ({
  $and: [
    { $eq: [{ $type: '$dueAt' }, 'date'] },
    { $lt: ['$dueAt', now] },
    {
      $not: [
        { $in: ['$status', [TaskStatus.Completed, TaskStatus.Cancelled]] },
      ],
    },
  ],
});

@Injectable()
export class TaskSupervisionService {
  private readonly logger = new Logger(TaskSupervisionService.name);
  constructor(
    @InjectModel(Task.name) private readonly tasks: Model<Task>,
    @InjectModel(Maintenance.name)
    private readonly maintenance: Model<Maintenance>,
    private readonly clock: TaskSupervisionClock,
  ) {}
  private scope(actor: AuthUser): PipelineStage.Match {
    if (actor.role !== Role.Manager)
      throw new ForbiddenException('Chỉ Manager được giám sát hàng đợi task');
    return { $match: taskSupervisionScope() };
  }
  private filters(query: TaskQueueFilters) {
    return {
      ...(query.taskType !== undefined ? { taskType: query.taskType } : {}),
      ...(query.sourceType !== undefined
        ? { sourceType: query.sourceType }
        : {}),
      // Task stores trimmed strings with no case normalization/collation. Preserve that contract.
      ...(query.priority !== undefined ? { priority: query.priority } : {}),
      ...(query.assigneeId
        ? { assignedTo: new Types.ObjectId(query.assigneeId) }
        : {}),
      ...(query.q
        ? {
            title: {
              $regex: query.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
              $options: 'i',
            },
          }
        : {}),
    };
  }
  private assigneeLookup(): PipelineStage.Lookup {
    return {
      $lookup: {
        from: 'users',
        localField: 'assignedTo',
        foreignField: '_id',
        pipeline: [{ $project: { fullName: 1, role: 1 } }],
        as: 'assigneeRows',
      },
    };
  }
  private assignee() {
    return {
      $cond: [
        { $gt: [{ $size: '$assigneeRows' }, 0] },
        {
          id: { $toString: { $arrayElemAt: ['$assigneeRows._id', 0] } },
          fullName: { $arrayElemAt: ['$assigneeRows.fullName', 0] },
          role: { $arrayElemAt: ['$assigneeRows.role', 0] },
        },
        null,
      ],
    };
  }
  private projection(detail = false): PipelineStage.Project {
    return {
      $project: {
        _id: 0,
        id: { $toString: '$_id' },
        title: 1,
        taskType: 1,
        priority: { $ifNull: ['$priority', null] },
        status: 1,
        sourceType: 1,
        sourceId: { $toString: '$sourceId' },
        assignee: this.assignee(),
        assignedAt: { $ifNull: ['$assignedAt', null] },
        dueAt: { $ifNull: ['$dueAt', null] },
        completedAt: { $ifNull: ['$completedAt', null] },
        overdue: 1,
        blocked: { $ifNull: ['$blocked', false] },
        ...(detail
          ? {
              workResult: {
                $cond: [
                  { $eq: ['$status', TaskStatus.Completed] },
                  { $ifNull: ['$workResult', null] },
                  '$$REMOVE',
                ],
              },
              blockerHistory: { $ifNull: ['$blockerHistory', []] },
              continuationHistory: { $ifNull: ['$continuationHistory', []] },
              instructions: 1,
              cancellation: 1,
              createdAt: 1,
              updatedAt: 1,
              source: {
                sourceType: '$sourceType',
                sourceId: { $toString: '$sourceId' },
              },
              sourceSummary: {
                $ifNull: [{ $arrayElemAt: ['$maintenanceRows', 0] }, null],
              },
            }
          : {}),
      },
    };
  }
  private warnMissing(rows: { id?: string; assignee: unknown }[]) {
    for (const row of rows)
      if (!row.assignee)
        this.logger.warn({
          event: 'task_supervision_missing_assignee',
          recordId: row.id ?? null,
        });
  }
  async summary(
    query: TaskQueueFilters,
    actor: AuthUser,
  ): Promise<TaskQueueSummary> {
    const scope = this.scope(actor);
    const now = this.clock.now();
    const filter = this.filters(query);
    const countStatus = (status: TaskStatus) => ({
      $sum: { $cond: [{ $eq: ['$status', status] }, 1, 0] },
    });
    const distinct = (field: string): PipelineStage.FacetPipelineStage[] => [
      { $match: { [field]: { $type: 'string', $ne: '' } } },
      { $group: { _id: `$${field}` } },
      { $sort: { _id: 1 } },
    ];
    // A single database aggregation generates counts/workload and global-scope facets together.
    const [result] = await this.tasks
      .aggregate([
        scope,
        { $set: { overdue: taskOverdueExpression(now) } },
        {
          $facet: {
            metrics: [
              { $match: filter },
              {
                $group: {
                  _id: '$status',
                  count: { $sum: 1 },
                  overdue: { $sum: { $cond: ['$overdue', 1, 0] } },
                },
              },
            ],
            workload: [
              { $match: filter },
              {
                $group: {
                  _id: { $ifNull: ['$assignedTo', null] },
                  assigned: countStatus(TaskStatus.Assigned),
                  inProgress: countStatus(TaskStatus.InProgress),
                  completed: countStatus(TaskStatus.Completed),
                  overdue: { $sum: { $cond: ['$overdue', 1, 0] } },
                },
              },
              {
                $set: {
                  assignedTo: '$_id',
                  open: { $add: ['$assigned', '$inProgress'] },
                },
              },
              { $sort: { open: -1, _id: 1 } },
              { $limit: 100 },
              this.assigneeLookup(),
              {
                $project: {
                  _id: 0,
                  id: { $toString: '$_id' },
                  assignee: this.assignee(),
                  assigned: 1,
                  inProgress: 1,
                  completed: 1,
                  overdue: 1,
                },
              },
            ],
            taskTypes: distinct('taskType'),
            priorities: distinct('priority'),
          },
        },
      ])
      .exec();
    const counts = {
      assigned: 0,
      inProgress: 0,
      completed: 0,
      other: 0,
      total: 0,
    };
    let overdue = 0;
    let cancelled = 0;
    for (const row of result?.metrics ?? []) {
      counts.total += row.count;
      overdue += row.overdue;
      if (row._id === TaskStatus.Assigned) counts.assigned += row.count;
      else if (row._id === TaskStatus.InProgress)
        counts.inProgress += row.count;
      else if (row._id === TaskStatus.Completed) counts.completed += row.count;
      else if (row._id === TaskStatus.Cancelled) cancelled += row.count;
      else counts.other += row.count;
    }
    this.warnMissing(result?.workload ?? []);
    return {
      counts: { ...counts, ...(cancelled ? { cancelled } : {}) },
      overdue,
      workload: (result?.workload ?? []).map(
        ({
          id: _id,
          ...row
        }: {
          id?: string;
          assignee: TaskQueueSummary['workload'][number]['assignee'];
          assigned: number;
          inProgress: number;
          completed: number;
          overdue: number;
        }) => row,
      ),
      facets: {
        taskTypes: (result?.taskTypes ?? []).map((r: { _id: string }) => r._id),
        priorities: (result?.priorities ?? []).map(
          (r: { _id: string }) => r._id,
        ),
      },
      generatedAt: now.toISOString(),
    };
  }
  async list(query: TaskQueueListQuery, actor: AuthUser) {
    const scope = this.scope(actor);
    const now = this.clock.now();
    const [result] = await this.tasks
      .aggregate([
        scope,
        {
          $match: {
            ...this.filters(query),
            ...(query.status ? { status: query.status } : {}),
          },
        },
        { $set: { overdue: taskOverdueExpression(now) } },
        ...(query.overdue === undefined
          ? []
          : [{ $match: { overdue: query.overdue } }]),
        {
          $facet: {
            items: [
              {
                $set: {
                  sortNull: {
                    $cond: [
                      { $eq: [{ $ifNull: [`$${query.sortBy}`, null] }, null] },
                      1,
                      0,
                    ],
                  },
                },
              },
              {
                $sort: {
                  sortNull: 1,
                  [query.sortBy]: query.sortOrder === 'desc' ? -1 : 1,
                  _id: query.sortOrder === 'desc' ? -1 : 1,
                },
              },
              { $skip: (query.page - 1) * query.limit },
              { $limit: query.limit },
              this.assigneeLookup(),
              this.projection(),
            ],
            count: [{ $count: 'total' }],
          },
        },
      ] as PipelineStage[])
      .exec();
    const items: SupervisedTask[] = result?.items ?? [];
    this.warnMissing(items);
    return {
      items,
      total: result?.count[0]?.total ?? 0,
      page: query.page,
      limit: query.limit,
    };
  }
  async detail(id: string, actor: AuthUser): Promise<SupervisedTaskDetail> {
    const scope = this.scope(actor);
    if (!/^[a-f\d]{24}$/i.test(id))
      throw new BadRequestException('Mã task không hợp lệ');
    const [row] = await this.tasks
      .aggregate<SupervisedTaskDetail>([
        scope,
        { $match: { _id: new Types.ObjectId(id) } },
        { $set: { overdue: taskOverdueExpression(this.clock.now()) } },
        this.assigneeLookup(),
        {
          $lookup: {
            from: this.maintenance.collection.name,
            let: { source: '$sourceId', kind: '$sourceType' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$$kind', TaskSourceType.Maintenance] },
                      { $eq: ['$_id', '$$source'] },
                    ],
                  },
                },
              },
              {
                $lookup: {
                  from: 'rooms',
                  localField: 'room',
                  foreignField: '_id',
                  pipeline: [{ $project: { _id: 0, roomNumber: 1 } }],
                  as: 'roomRows',
                },
              },
              {
                $lookup: {
                  from: 'equipment',
                  localField: 'equipment',
                  foreignField: '_id',
                  pipeline: [{ $project: { _id: 0, assetCode: 1, name: 1 } }],
                  as: 'equipmentRows',
                },
              },
              {
                $project: {
                  _id: 0,
                  description: 1,
                  preventsSafeUse: 1,
                  room: { $ifNull: [{ $arrayElemAt: ['$roomRows', 0] }, null] },
                  equipment: {
                    $ifNull: [{ $arrayElemAt: ['$equipmentRows', 0] }, null],
                  },
                },
              },
            ],
            as: 'maintenanceRows',
          },
        },
        this.projection(true),
      ])
      .exec();
    if (!row) throw new NotFoundException('Không tìm thấy task');
    this.warnMissing([row]);
    return row;
  }
}
