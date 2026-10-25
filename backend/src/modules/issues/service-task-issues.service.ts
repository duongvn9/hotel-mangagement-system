import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  type OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { createHash } from 'node:crypto';
import { Model, Types } from 'mongoose';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { Role } from '../../common/constants/role.enum.js';
import { Booking } from '../bookings/schemas/booking.schema.js';
import { ServiceOrder } from '../service-orders/schemas/service-order.schema.js';
import { ServiceOrderReviewStatus } from '../service-orders/service-order-status.js';
import { Service } from '../services/schemas/service.schema.js';
import { Task } from '../tasks/schemas/task.schema.js';
import {
  SERVICE_ORDER_EXECUTION_TASK_TYPE,
  TaskSourceType,
  TaskStatus,
} from '../tasks/task-contract.js';
import { User } from '../users/schemas/user.schema.js';
import { ServiceTaskIssueDto } from './dto/create-issue.dto.js';
import {
  Issue,
  ISSUE_REQUEST_INDEX,
  IssuePriority,
  IssueStatus,
} from './schemas/issue.schema.js';

@Injectable()
export class ServiceTaskIssuesService implements OnModuleInit {
  constructor(
    @InjectModel(Issue.name) private readonly issues: Model<Issue>,
    @InjectModel(Task.name) private readonly tasks: Model<Task>,
    @InjectModel(ServiceOrder.name)
    private readonly orders: Model<ServiceOrder>,
    @InjectModel(Service.name) private readonly services: Model<Service>,
    @InjectModel(Booking.name) private readonly bookings: Model<Booking>,
    @InjectModel(User.name) private readonly users: Model<User>,
  ) {}

  async onModuleInit() {
    await this.issues.collection.createIndex(
      { reporter: 1, requestId: 1 },
      ISSUE_REQUEST_INDEX,
    );
  }

  private async source(taskId: string, user: AuthUser) {
    if (!user || !/^[a-fA-F0-9]{24}$/.test(user.id))
      throw new UnauthorizedException();
    if (user.role !== Role.ServiceStaff) throw new ForbiddenException();
    const staff = await this.users
      .findOne({
        _id: new Types.ObjectId(user.id),
        role: Role.ServiceStaff,
        isActive: true,
      })
      .select({ _id: 1 })
      .lean();
    if (!staff) throw new ForbiddenException();
    if (!/^[a-fA-F0-9]{24}$/.test(taskId))
      throw new NotFoundException('Service task context not found');
    const task = await this.tasks
      .findOne({
        _id: new Types.ObjectId(taskId),
        assignedTo: staff._id,
        sourceType: TaskSourceType.ServiceOrder,
        taskType: SERVICE_ORDER_EXECUTION_TASK_TYPE,
      })
      .select({ _id: 1, title: 1, status: 1, sourceId: 1 })
      .lean();
    if (!task) throw new NotFoundException('Service task context not found');
    const order = await this.orders
      .findOne({
        _id: task.sourceId,
        linkedTask: task._id,
        reviewStatus: ServiceOrderReviewStatus.Accepted,
      })
      .select({ _id: 1, service: 1, booking: 1, customer: 1 })
      .lean();
    if (!order) throw new NotFoundException('Service task context not found');
    const [service, booking] = await Promise.all([
      this.services
        .findById(order.service)
        .select({ _id: 1, name: 1, unit: 1 })
        .lean(),
      this.bookings
        .findOne({
          _id: order.booking,
          customer: order.customer,
          isActive: true,
        })
        .select({ _id: 1, code: 1 })
        .lean(),
    ]);
    if (!service || !booking)
      throw new NotFoundException('Service task context not found');
    return { task, order, service, booking };
  }

  async context(taskId: string, user: AuthUser) {
    const { task, order, service, booking } = await this.source(taskId, user);
    this.assertExecuting(task.status);
    return {
      taskId: String(task._id),
      taskTitle: task.title,
      taskStatus: task.status,
      serviceOrderId: String(order._id),
      service: {
        id: String(service._id),
        name: service.name,
        unit: service.unit,
      },
      booking: { id: String(booking._id), code: booking.code },
    };
  }

  private assertExecuting(status: TaskStatus) {
    if (status !== TaskStatus.InProgress)
      throw new ConflictException('Service task must be IN_PROGRESS');
  }

  private response(issue: Issue & { _id: Types.ObjectId }) {
    return {
      id: String(issue._id),
      title: issue.title,
      category: issue.category,
      description: issue.description,
      priority: issue.priority,
      status: issue.status,
      reportedAt: issue.reportedAt,
      bookingId: String(issue.booking),
      serviceOrderId: String(issue.serviceOrder),
      sourceTaskId: String(issue.sourceTask),
      serviceId: String(issue.service),
    };
  }

  async report(taskId: string, input: ServiceTaskIssueDto, user: AuthUser) {
    const source = await this.source(taskId, user);
    if (!input || typeof input !== 'object' || Array.isArray(input))
      throw new BadRequestException('Invalid input');
    const dto = plainToInstance(ServiceTaskIssueDto, input);
    if (
      (await validate(dto, { whitelist: true, forbidNonWhitelisted: true }))
        .length
    )
      throw new BadRequestException('Invalid input');
    const fingerprint = createHash('sha256')
      .update(
        JSON.stringify([
          String(source.task._id),
          dto.title,
          dto.category,
          dto.description,
        ]),
      )
      .digest('hex');
    const key =
      dto.requestId === undefined
        ? undefined
        : {
            reporter: new Types.ObjectId(user.id),
            requestId: dto.requestId.toLowerCase(),
          };
    const existing = async () => {
      if (!key) return null;
      const issue = await this.issues
        .findOne(key)
        .select('+requestFingerprint')
        .lean();
      if (!issue) return null;
      if (issue.requestFingerprint !== fingerprint)
        throw new ConflictException(
          'requestId already used for a different report',
        );
      return this.response(issue);
    };
    const retry = await existing();
    if (retry) return retry;
    this.assertExecuting(source.task.status);
    try {
      const issue = await this.issues.create({
        title: dto.title,
        category: dto.category,
        description: dto.description,
        reporter: new Types.ObjectId(user.id),
        booking: source.booking._id,
        serviceOrder: source.order._id,
        sourceTask: source.task._id,
        service: source.service._id,
        priority: IssuePriority.Normal,
        status: IssueStatus.PendingReview,
        reportedAt: new Date(),
        ...(key
          ? { requestId: key.requestId, requestFingerprint: fingerprint }
          : {}),
      });
      return this.response(issue);
    } catch (error) {
      if (key && (error as { code?: number }).code === 11000) {
        const raced = await existing();
        if (raced) return raced;
      }
      throw error;
    }
  }
}
