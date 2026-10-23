import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Connection, Model, Types } from 'mongoose';
import { Role as StaffRole } from '../../common/constants/role.enum.js';
import { Role } from '../roles/schemas/role.schema.js';
import { User } from '../users/schemas/user.schema.js';
import { CreateTaskDto } from './dto/create-task.dto.js';
import { Task } from './schemas/task.schema.js';
import { TaskSourceType, TaskStatus } from './task-contract.js';

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
    if (!assignee || assignee.isActive !== true) {
      throw new BadRequestException('Assignee must be an active staff member');
    }
    const builtInStaff = [
      StaffRole.ServiceStaff,
      StaffRole.OperationsStaff,
    ].some((role) => role === assignee.role);
    if (
      !builtInStaff &&
      !(await this.roles.exists({
        code: assignee.role,
        isActive: true,
        permissions: { $all: ['task:execute'] },
      }))
    ) {
      throw new BadRequestException('Assignee cannot execute tasks');
    }

    const sourceId = new Types.ObjectId(dto.sourceId);
    const source = await this.connection
      .collection(TASK_SOURCE_COLLECTIONS[dto.sourceType])
      .findOne({ _id: sourceId }, { projection: { _id: 1 } });
    if (!source) throw new BadRequestException('Task source does not exist');

    return this.tasks.create({
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
  }
}
