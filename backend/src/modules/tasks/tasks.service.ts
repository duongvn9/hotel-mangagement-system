import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Connection, Model, Types } from 'mongoose';
import { Role as StaffRole } from '../../common/constants/role.enum.js';
import { Role } from '../roles/schemas/role.schema.js';
import { User } from '../users/schemas/user.schema.js';
import { CreateTaskDto } from './dto/create-task.dto.js';
import { Task } from './schemas/task.schema.js';
import {
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

  async create(input: CreateTaskDto) {
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
        title: dto.title.trim(),
        taskType: dto.taskType.trim(),
        priority: dto.priority.trim(),
        sourceType: dto.sourceType,
        sourceId,
        assignedTo: new Types.ObjectId(dto.assigneeId),
        assignedAt: new Date(),
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
    this.assertEligible(actor, task.sourceType);
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
    return updated;
  }
}
