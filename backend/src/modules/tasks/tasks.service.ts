import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Model, Types, type Connection } from 'mongoose';
import { Role as StaffRole } from '../../common/constants/role.enum.js';
import { Role } from '../roles/schemas/role.schema.js';
import { User } from '../users/schemas/user.schema.js';
import { CreateTaskDto } from './dto/create-task.dto.js';
import { UpdateTaskProgressDto } from './dto/update-task-progress.dto.js';
import { Task } from './schemas/task.schema.js';
import {
  AssignedTaskDto,
  AssignedTasksPageDto,
} from './dto/assigned-task.dto.js';
import { ListAssignedTasksQuery } from './dto/list-assigned-tasks.dto.js';
import {
  SERVICE_ORDER_EXECUTION_TASK_TYPE,
  canTransitionTaskStatus,
  TaskSourceType,
  TaskStatus,
} from './task-contract.js';

export const TASK_SOURCE_COLLECTIONS: Readonly<Record<TaskSourceType, string>> =
  Object.freeze({
    [TaskSourceType.ServiceOrder]: 'serviceorders',
    [TaskSourceType.Issue]: 'issues',
    [TaskSourceType.Maintenance]: 'maintenances',
  });

@Injectable()
export class TasksService {
  constructor(
    @InjectModel(Task.name) private readonly tasks: Model<Task>,
    @InjectModel(User.name) private readonly users: Model<User>,
    @InjectModel(Role.name) private readonly roles: Model<Role>,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  private readonly assignedProjection = {
    _id: 1,
    title: 1,
    taskType: 1,
    priority: 1,
    status: 1,
    assignedAt: 1,
    dueAt: 1,
    completedAt: 1,
    workResult: 1,
    sourceType: 1,
    sourceId: 1,
  };

  async listAssigned(
    actorUserId: string,
    query: ListAssignedTasksQuery,
  ): Promise<AssignedTasksPageDto> {
    const assignedTo = this.assignedActorId(actorUserId);
    const filter = {
      assignedTo,
      ...(query.status === undefined ? {} : { status: query.status }),
      ...(query.taskType === undefined ? {} : { taskType: query.taskType }),
      ...(query.keyword === undefined
        ? {}
        : {
            title: {
              $regex: query.keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
              $options: 'i',
            },
          }),
    };
    const [tasks, total] = await Promise.all([
      this.tasks
        .find(filter)
        .select(this.assignedProjection)
        .sort({ assignedAt: -1, _id: -1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .lean(),
      this.tasks.countDocuments(filter),
    ]);
    return {
      items: tasks.map((task) => this.assignedResponse(task)),
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  async findAssigned(
    actorUserId: string,
    taskId: string,
  ): Promise<AssignedTaskDto> {
    const assignedTo = this.assignedActorId(actorUserId);
    if (!/^[a-fA-F0-9]{24}$/.test(taskId))
      throw new NotFoundException('Task not found');
    const task = await this.tasks
      .findOne({ _id: new Types.ObjectId(taskId), assignedTo })
      .select(this.assignedProjection)
      .lean();
    if (!task) throw new NotFoundException('Task not found');
    return this.assignedResponse(task);
  }

  private assignedActorId(id: string): Types.ObjectId {
    if (typeof id !== 'string' || !/^[a-fA-F0-9]{24}$/.test(id)) {
      throw new BadRequestException('Invalid actor ID');
    }
    return new Types.ObjectId(id);
  }

  private assignedResponse(
    task: Task & { _id: Types.ObjectId },
  ): AssignedTaskDto {
    return {
      id: String(task._id),
      title: task.title,
      taskType: task.taskType,
      priority: task.priority,
      status: task.status,
      assignedAt: task.assignedAt.toISOString(),
      ...(task.dueAt === undefined ? {} : { dueAt: task.dueAt.toISOString() }),
      ...(task.completedAt === undefined
        ? {}
        : { completedAt: task.completedAt.toISOString() }),
      ...(task.workResult === undefined ? {} : { workResult: task.workResult }),
      sourceType: task.sourceType,
      sourceId: String(task.sourceId),
      sourceSummary: null,
    };
  }

  async findServiceOrderExecutionWork(orderId: string, taskId: Types.ObjectId) {
    return this.tasks
      .findOne({
        _id: taskId,
        sourceType: TaskSourceType.ServiceOrder,
        sourceId: new Types.ObjectId(orderId),
        taskType: SERVICE_ORDER_EXECUTION_TASK_TYPE,
      })
      .lean();
  }

  async listCompletedServiceWork(
    actorId: string,
    query: {
      page: number;
      limit: number;
      keyword?: string;
      from?: string;
      to?: string;
    },
    orderId?: Types.ObjectId,
  ) {
    const completedAt = {
      $type: 'date',
      ...(query.from ? { $gte: new Date(query.from) } : {}),
      ...(query.to ? { $lte: new Date(query.to) } : {}),
    };
    const [result] = await this.tasks.aggregate<{
      items: (Task & { _id: Types.ObjectId; order: Record<string, unknown> })[];
      count: { total: number }[];
    }>([
      {
        $match: {
          assignedTo: this.assignedActorId(actorId),
          sourceType: TaskSourceType.ServiceOrder,
          taskType: SERVICE_ORDER_EXECUTION_TASK_TYPE,
          status: TaskStatus.Completed,
          completedAt,
          workResult: { $type: 'string', $regex: /\S/ },
          ...(orderId ? { sourceId: orderId } : {}),
        },
      },
      {
        $match: {
          $expr: {
            $lte: [
              {
                $strLenCP: {
                  $cond: [
                    { $eq: [{ $type: '$workResult' }, 'string'] },
                    '$workResult',
                    '',
                  ],
                },
              },
              2000,
            ],
          },
        },
      },
      {
        $lookup: {
          from: TASK_SOURCE_COLLECTIONS[TaskSourceType.ServiceOrder],
          localField: 'sourceId',
          foreignField: '_id',
          as: 'order',
        },
      },
      { $unwind: '$order' },
      {
        $match: {
          'order.reviewStatus': 'ACCEPTED',
          $expr: { $eq: ['$order.linkedTask', '$_id'] },
          ...(query.keyword
            ? {
                'order.serviceName': {
                  $regex: query.keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
                  $options: 'i',
                },
              }
            : {}),
        },
      },
      { $sort: { completedAt: -1, _id: -1 } },
      {
        $facet: {
          items: [
            { $skip: (query.page - 1) * query.limit },
            { $limit: query.limit },
          ],
          count: [{ $count: 'total' }],
        },
      },
    ]);
    return { items: result?.items ?? [], total: result?.count[0]?.total ?? 0 };
  }

  private readonly logger = new Logger(TasksService.name);

  async repairServiceOrderExecution(task: Task & { _id: Types.ObjectId }) {
    if (
      task.sourceType !== TaskSourceType.ServiceOrder ||
      task.taskType !== SERVICE_ORDER_EXECUTION_TASK_TYPE
    )
      return;
    const predecessors = {
      [TaskStatus.Assigned]: ['ASSIGNED'],
      [TaskStatus.InProgress]: ['ASSIGNED', 'IN_PROGRESS'],
      [TaskStatus.Completed]: ['ASSIGNED', 'IN_PROGRESS', 'COMPLETED'],
    };
    await this.connection
      .collection(TASK_SOURCE_COLLECTIONS[TaskSourceType.ServiceOrder])
      .updateOne(
        {
          _id: task.sourceId,
          linkedTask: task._id,
          reviewStatus: 'ACCEPTED',
          executionStatus: { $in: predecessors[task.status] },
        },
        { $set: { executionStatus: task.status } },
      );
  }

  async findIssueResolutionWork(issueId: string) {
    return this.tasks
      .findOne({
        sourceType: TaskSourceType.Issue,
        sourceId: new Types.ObjectId(issueId),
        taskType: 'ISSUE_RESOLUTION',
      })
      .sort({ assignedAt: -1, _id: -1 })
      .lean();
  }

  async create(
    input: CreateTaskDto,
    identity?: Types.ObjectId,
    assignedAt?: Date,
  ) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new BadRequestException('Invalid task input');
    }
    const dto = plainToInstance(CreateTaskDto, input);
    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    if (errors.length) throw new BadRequestException('Invalid task input');

    const assignee = await this.users.findById(dto.assigneeId).lean();
    if (!assignee) throw new NotFoundException('Assignee does not exist');
    this.assertEligible(assignee, dto.sourceType);

    const sourceId = new Types.ObjectId(dto.sourceId);
    const source = await this.connection
      .collection(TASK_SOURCE_COLLECTIONS[dto.sourceType])
      .findOne({ _id: sourceId }, { projection: { _id: 1 } });
    if (!source) throw new NotFoundException('Task source does not exist');

    await this.ensureWorkIndex();
    try {
      return await this.tasks.create({
        ...(identity ? { _id: identity } : {}),
        title: dto.title.trim(),
        taskType: dto.taskType.trim(),
        priority: dto.priority.trim(),
        sourceType: dto.sourceType,
        sourceId,
        assignedTo: new Types.ObjectId(dto.assigneeId),
        assignedAt: assignedAt ?? new Date(),
        status: TaskStatus.Assigned,
        ...(dto.dueAt === undefined ? {} : { dueAt: new Date(dto.dueAt) }),
      });
    } catch (error) {
      if (this.isDuplicate(error)) {
        throw new ConflictException(
          'An active task already exists for this work',
        );
      }
      throw error;
    }
  }

  private workIndex?: Promise<unknown>;

  private ensureWorkIndex() {
    this.workIndex ??= this.tasks.collection.createIndex(
      { sourceType: 1, sourceId: 1, taskType: 1 },
      {
        name: 'unique_active_task_work',
        unique: true,
        partialFilterExpression: {
          status: { $in: [TaskStatus.Assigned, TaskStatus.InProgress] },
        },
      },
    );
    return this.workIndex.catch((error: unknown) => {
      if (this.isDuplicate(error)) {
        throw new ConflictException(
          'Active task duplicates prevent index initialization',
        );
      }
      throw error;
    });
  }

  private isDuplicate(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 11000
    );
  }

  private assertEligible(
    assignee: Pick<User, 'isActive' | 'role'>,
    source: TaskSourceType,
  ) {
    const allowed =
      source === TaskSourceType.ServiceOrder
        ? [StaffRole.ServiceStaff]
        : source === TaskSourceType.Maintenance
          ? [StaffRole.OperationsStaff]
          : source === TaskSourceType.Issue
            ? [StaffRole.ServiceStaff, StaffRole.OperationsStaff]
            : [];
    if (
      assignee.isActive !== true ||
      !allowed.some((role) => role === assignee.role)
    ) {
      throw new BadRequestException(
        'Assignee must be active staff appropriate to the source work',
      );
    }
  }

  async updateAssignedProgress(
    actorUserId: string,
    taskId: string,
    input: UpdateTaskProgressDto,
  ): Promise<AssignedTaskDto> {
    await this.findAssigned(actorUserId, taskId);
    const expectedStatus =
      input.status === TaskStatus.InProgress
        ? TaskStatus.Assigned
        : TaskStatus.InProgress;
    const updated = await this.transitionAssignedTask(
      taskId,
      actorUserId,
      expectedStatus,
      input.status,
      input.workResult,
    );
    return this.assignedResponse(updated);
  }

  private async assertTransitionEligible(actor: User, source: TaskSourceType) {
    if (!Object.values(StaffRole).some((role) => role === actor.role)) {
      if (
        actor.isActive === true &&
        (await this.roles.exists({
          code: actor.role,
          isActive: true,
          permissions: { $all: ['task:execute'] },
        }))
      ) {
        return;
      }
    }
    this.assertEligible(actor, source);
  }

  async transitionAssignedTask(
    taskId: string,
    actorUserId: string,
    expectedStatus: TaskStatus,
    nextStatus: TaskStatus,
    workResult?: string,
  ) {
    if (
      ![taskId, actorUserId].every(
        (id) => typeof id === 'string' && /^[a-fA-F0-9]{24}$/.test(id),
      )
    ) {
      throw new BadRequestException('Invalid task or actor ID');
    }
    if (!canTransitionTaskStatus(expectedStatus, nextStatus)) {
      throw new ConflictException('Invalid task status transition');
    }
    if (nextStatus === TaskStatus.Completed) {
      if (typeof workResult !== 'string' || !workResult.trim()) {
        throw new BadRequestException('Completion requires a work result');
      }
      if (workResult.trim().length > 2000) {
        throw new BadRequestException(
          'Work result must not exceed 2000 characters',
        );
      }
    } else if (workResult !== undefined) {
      throw new BadRequestException(
        'Work result is only accepted on completion',
      );
    }
    const scope = {
      _id: new Types.ObjectId(taskId),
      assignedTo: new Types.ObjectId(actorUserId),
      status: expectedStatus,
    };
    const task = await this.tasks.findOne(scope).lean();
    if (!task)
      throw new ConflictException(
        'Task is not assigned to actor at expected status',
      );
    const actor = await this.users.findById(actorUserId).lean();
    if (!actor) throw new NotFoundException('Assignee does not exist');
    await this.assertTransitionEligible(actor, task.sourceType);
    if (
      task.sourceType === TaskSourceType.ServiceOrder &&
      task.taskType === SERVICE_ORDER_EXECUTION_TASK_TYPE
    ) {
      const order = await this.connection
        .collection(TASK_SOURCE_COLLECTIONS[TaskSourceType.ServiceOrder])
        .findOne(
          {
            _id: task.sourceId,
            linkedTask: task._id,
            reviewStatus: 'ACCEPTED',
            executionStatus: { $in: Object.values(TaskStatus) },
          },
          { projection: { _id: 1 } },
        );
      if (!order)
        throw new ConflictException(
          'Service order assignment is not finalized for this task',
        );
    }
    await this.ensureWorkIndex();
    const updated = await this.tasks.findOneAndUpdate(
      scope,
      {
        $set: {
          status: nextStatus,
          ...(nextStatus === TaskStatus.Completed
            ? { workResult: workResult!.trim(), completedAt: new Date() }
            : {}),
        },
      },
      { new: true, runValidators: true },
    );
    if (!updated)
      throw new ConflictException('Task assignment or status changed');
    try {
      await this.repairServiceOrderExecution(updated);
    } catch {
      this.logger.warn(
        'Service order progress projection pending; source reads repair from Task truth',
      );
    }
    return updated;
  }
}
