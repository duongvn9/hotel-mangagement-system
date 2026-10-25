import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { Role } from '../../common/constants/role.enum.js';
import { Booking } from '../bookings/schemas/booking.schema.js';
import { ListIssuesQuery } from './dto/list-issues.dto.js';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateIssueDto } from './dto/create-issue.dto.js';
import { IssueContextAdapter } from './issue-context.adapter.js';
import {
  HandlingCategory,
  Issue,
  IssuePriority,
  IssueStatus,
} from './schemas/issue.schema.js';
import { User } from '../users/schemas/user.schema.js';
import { TasksService } from '../tasks/tasks.service.js';
import { TaskSourceType, TaskStatus } from '../tasks/task-contract.js';
import {
  AssignIssueDto,
  CloseIssueDto,
  ReviewIssueDto,
} from './dto/review-issue.dto.js';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

export interface IssueResponse {
  id: string;
  title: string;
  category: string;
  description: string;
  priority: IssuePriority;
  status: IssueStatus;
  reportedAt: Date;
  bookingId: string;
  roomId?: string;
  serviceOrderId?: string;
  sourceTaskId?: string;
  serviceId?: string;
}

export interface IssueRead extends Omit<IssueResponse, 'reportedAt'> {
  reportedAt: string;
  closedAt?: string;
  closedBy?: string;
  closureConclusion?: string;
  handlingCategory?: HandlingCategory;
  needsStaffAction?: boolean;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  concludedAt?: string;
  assignmentRequestedBy?: string;
  assignmentRequestedAt?: string;
  assigneeId?: string;
  dueAt?: string;
  assignedAt?: string;
}

export interface IssuesPage {
  items: IssueRead[];
  total: number;
  page: number;
  limit: number;
}

export interface IssueDetail extends IssueRead {
  linkedTasks: {
    id: string;
    title: string;
    taskType: string;
    priority: string;
    status: string;
    assigneeId: string;
    assignedAt: string;
    dueAt?: string;
    completedAt?: string;
  }[];
  linkedTasksAvailable: boolean;
}

@Injectable()
export class IssuesService {
  constructor(
    @InjectModel(Issue.name) private readonly issues: Model<Issue>,
    private readonly contexts: IssueContextAdapter,
    @InjectModel(Booking.name) private readonly bookings: Model<Booking>,
    @InjectModel(User.name) private readonly users: Model<User>,
    private readonly tasks: TasksService,
  ) {}

  private readonly readProjection = {
    _id: 1,
    title: 1,
    category: 1,
    description: 1,
    priority: 1,
    status: 1,
    reportedAt: 1,
    closedAt: 1,
    closedBy: 1,
    closureConclusion: 1,
    booking: 1,
    room: 1,
    serviceOrder: 1,
    sourceTask: 1,
    service: 1,
    handlingCategory: 1,
    needsStaffAction: 1,
    reviewedBy: 1,
    reviewedAt: 1,
    reviewNotes: 1,
    concludedAt: 1,
    assignmentRequestedBy: 1,
    assignmentRequestedAt: 1,
    assignmentAssignee: 1,
    assignmentDueAt: 1,
    assignedAt: 1,
    linkedTask: 1,
  };

  private assertReader(user: AuthUser): void {
    if (!user || !/^[a-fA-F0-9]{24}$/.test(user.id)) {
      throw new UnauthorizedException();
    }
    if (
      ![Role.Customer, Role.Receptionist, Role.Manager].some(
        (role) => role === user.role,
      )
    ) {
      throw new ForbiddenException('Không có quyền dùng chức năng này');
    }
  }

  private async readScope(user: AuthUser) {
    this.assertReader(user);
    if (user.role !== Role.Customer) return {};
    const bookings = await this.bookings
      .find({ customer: new Types.ObjectId(user.id), isActive: true })
      .select({ _id: 1 })
      .lean();
    return { booking: { $in: bookings.map((booking) => booking._id) } };
  }

  async list(query: ListIssuesQuery, user: AuthUser): Promise<IssuesPage> {
    const scope = await this.readScope(user);
    const filter = {
      ...scope,
      ...(query.status === undefined ? {} : { status: query.status }),
      ...(query.priority === undefined ? {} : { priority: query.priority }),
      ...(query.category === undefined ? {} : { category: query.category }),
      ...(query.keyword === undefined
        ? {}
        : {
            title: {
              $regex: query.keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
              $options: 'i',
            },
          }),
    };
    const [items, total] = await Promise.all([
      this.issues
        .find(filter)
        .select(this.readProjection)
        .sort({ reportedAt: -1, _id: -1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .lean(),
      this.issues.countDocuments(filter),
    ]);
    return {
      items: items.map((issue) => this.readResponse(issue, user)),
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  async findOne(id: string, user: AuthUser): Promise<IssueDetail> {
    this.assertReader(user);
    if (!/^[a-fA-F0-9]{24}$/.test(id))
      throw new NotFoundException('Issue not found');
    const scope = await this.readScope(user);
    const issue = await this.issues
      .findOne({ _id: new Types.ObjectId(id), ...scope })
      .select(this.readProjection)
      .lean();
    if (!issue) throw new NotFoundException('Issue not found');
    const staff = user.role !== Role.Customer;
    const task =
      staff && issue.linkedTask
        ? await this.tasks.findIssueResolutionWork(id)
        : null;
    return {
      ...this.readResponse(issue, user),
      linkedTasks:
        task && String(task._id) === String(issue.linkedTask)
          ? [
              {
                id: String(task._id),
                title: task.title,
                taskType: task.taskType,
                priority: task.priority,
                status: task.status,
                assigneeId: String(task.assignedTo),
                assignedAt: task.assignedAt.toISOString(),
                ...(task.dueAt ? { dueAt: task.dueAt.toISOString() } : {}),
                ...(task.completedAt
                  ? { completedAt: task.completedAt.toISOString() }
                  : {}),
              },
            ]
          : [],
      linkedTasksAvailable: staff && Boolean(issue.linkedTask),
    };
  }

  private readResponse(
    issue: Issue & { _id: Types.ObjectId },
    user: AuthUser,
  ): IssueRead {
    return {
      id: String(issue._id),
      title: issue.title,
      category: issue.category,
      description: issue.description,
      priority: issue.priority,
      status: issue.status,
      reportedAt: issue.reportedAt.toISOString(),
      bookingId: String(issue.booking),
      ...(issue.room ? { roomId: String(issue.room) } : {}),
      ...(issue.serviceOrder
        ? { serviceOrderId: String(issue.serviceOrder) }
        : {}),
      ...(issue.sourceTask ? { sourceTaskId: String(issue.sourceTask) } : {}),
      ...(issue.service ? { serviceId: String(issue.service) } : {}),
      ...(issue.closedAt ? { closedAt: issue.closedAt.toISOString() } : {}),
      ...(issue.handlingCategory
        ? { handlingCategory: issue.handlingCategory }
        : {}),
      ...(issue.needsStaffAction === undefined
        ? {}
        : { needsStaffAction: issue.needsStaffAction }),
      ...(issue.reviewedAt
        ? { reviewedAt: issue.reviewedAt.toISOString() }
        : {}),
      ...(issue.concludedAt
        ? { concludedAt: issue.concludedAt.toISOString() }
        : {}),
      ...(user.role === Role.Customer
        ? {}
        : {
            ...(issue.closedBy ? { closedBy: String(issue.closedBy) } : {}),
            ...(issue.closureConclusion === undefined
              ? {}
              : { closureConclusion: issue.closureConclusion }),
            ...(issue.reviewedBy
              ? { reviewedBy: String(issue.reviewedBy) }
              : {}),
            ...(issue.reviewNotes === undefined
              ? {}
              : { reviewNotes: issue.reviewNotes }),
            ...(issue.assignmentRequestedBy
              ? { assignmentRequestedBy: String(issue.assignmentRequestedBy) }
              : {}),
            ...(issue.assignmentRequestedAt
              ? {
                  assignmentRequestedAt:
                    issue.assignmentRequestedAt.toISOString(),
                }
              : {}),
            ...(issue.assignmentAssignee
              ? { assigneeId: String(issue.assignmentAssignee) }
              : {}),
            ...(issue.assignmentDueAt
              ? { dueAt: issue.assignmentDueAt.toISOString() }
              : {}),
            ...(issue.assignedAt
              ? { assignedAt: issue.assignedAt.toISOString() }
              : {}),
          }),
    };
  }

  private assertReceptionist(user: AuthUser) {
    if (!user || !/^[a-fA-F0-9]{24}$/.test(user.id))
      throw new UnauthorizedException();
    if (user.role !== Role.Receptionist) throw new ForbiddenException();
  }

  private async validateInput<T extends object>(
    type: new () => T,
    input: T,
  ): Promise<T> {
    if (!input || typeof input !== 'object' || Array.isArray(input))
      throw new BadRequestException('Invalid input');
    const dto = plainToInstance(type, input);
    if (
      (await validate(dto, { whitelist: true, forbidNonWhitelisted: true }))
        .length
    )
      throw new BadRequestException('Invalid input');
    return dto;
  }

  private async operationalIssue(id: string) {
    if (!/^[a-fA-F0-9]{24}$/.test(id))
      throw new NotFoundException('Issue not found');
    const issue = await this.issues.findById(id).lean();
    if (!issue) throw new NotFoundException('Issue not found');
    return issue;
  }

  async review(
    id: string,
    input: ReviewIssueDto,
    user: AuthUser,
  ): Promise<IssueDetail> {
    this.assertReceptionist(user);
    const dto = await this.validateInput(ReviewIssueDto, input);
    await this.operationalIssue(id);
    const now = new Date();
    const issue = await this.issues.findOneAndUpdate(
      {
        _id: new Types.ObjectId(id),
        status: IssueStatus.PendingReview,
        linkedTask: { $exists: false },
      },
      {
        $set: {
          handlingCategory: dto.handlingCategory,
          priority: dto.priority,
          needsStaffAction: dto.needsStaffAction,
          reviewedBy: new Types.ObjectId(user.id),
          reviewedAt: now,
          ...(dto.notes === undefined ? {} : { reviewNotes: dto.notes }),
          status: dto.needsStaffAction
            ? IssueStatus.Reviewed
            : IssueStatus.Concluded,
          ...(dto.needsStaffAction ? {} : { concludedAt: now }),
        },
      },
      { new: true, runValidators: true },
    );
    if (!issue)
      throw new ConflictException('Issue is no longer pending review');
    return this.findOne(id, user);
  }

  private handlingRole(category?: HandlingCategory) {
    if (category === HandlingCategory.Service) return Role.ServiceStaff;
    if (category === HandlingCategory.Operations) return Role.OperationsStaff;
    throw new ConflictException('Issue requires a handling classification');
  }

  async assignees(id: string, user: AuthUser) {
    this.assertReceptionist(user);
    const issue = await this.operationalIssue(id);
    if (
      ![IssueStatus.Reviewed, IssueStatus.Assigning].includes(issue.status) ||
      issue.needsStaffAction !== true
    )
      throw new ConflictException('Issue is not eligible for assignment');
    const items = await this.users
      .find({ isActive: true, role: this.handlingRole(issue.handlingCategory) })
      .select({ _id: 1, fullName: 1, role: 1 })
      .sort({ fullName: 1, _id: 1 })
      .lean();
    return {
      items: items.map((staff) => ({
        id: String(staff._id),
        displayName: staff.fullName,
        role: staff.role,
      })),
    };
  }

  async assign(
    id: string,
    input: AssignIssueDto,
    user: AuthUser,
  ): Promise<IssueDetail> {
    this.assertReceptionist(user);
    const dto = await this.validateInput(AssignIssueDto, input);
    const dueAt = dto.dueAt === undefined ? undefined : new Date(dto.dueAt);
    if (dueAt && !Number.isFinite(dueAt.getTime()))
      throw new BadRequestException('Invalid dueAt');
    let issue = await this.operationalIssue(id);
    if (
      issue.status === IssueStatus.Reviewed &&
      issue.needsStaffAction === true
    ) {
      const staff = await this.users
        .findOne({
          _id: new Types.ObjectId(dto.assigneeId),
          isActive: true,
          role: this.handlingRole(issue.handlingCategory),
        })
        .lean();
      if (!staff)
        throw new BadRequestException(
          'Assignee must be active staff matching handlingCategory',
        );
      const locked = await this.issues
        .findOneAndUpdate(
          {
            _id: issue._id,
            status: IssueStatus.Reviewed,
            needsStaffAction: true,
            linkedTask: { $exists: false },
          },
          {
            $set: {
              status: IssueStatus.Assigning,
              assignmentAssignee: staff._id,
              assignmentRequestedBy: new Types.ObjectId(user.id),
              assignmentRequestedAt: new Date(),
              assignmentTitle: issue.title,
              assignmentTaskId: new Types.ObjectId(),
              ...(dueAt ? { assignmentDueAt: dueAt } : {}),
            },
          },
          { new: true, runValidators: true },
        )
        .lean();
      if (!locked)
        throw new ConflictException(
          'Assignment changed; retry the same intent',
        );
      issue = locked;
    } else if (issue.status !== IssueStatus.Assigning) {
      throw new ConflictException('Issue is not eligible for assignment');
    }
    if (
      String(issue.assignmentAssignee) !==
        String(new Types.ObjectId(dto.assigneeId)) ||
      issue.assignmentDueAt?.getTime() !== dueAt?.getTime()
    )
      throw new ConflictException(
        'A different assignment intent is already pending',
      );
    if (!issue.assignmentTaskId || !issue.assignmentTitle)
      throw new ConflictException('Assignment intent is incomplete');
    let task = await this.tasks.findIssueResolutionWork(id);
    if (!task) {
      try {
        task = await this.tasks.create(
          {
            title: issue.assignmentTitle,
            taskType: 'ISSUE_RESOLUTION',
            priority: issue.priority,
            sourceType: TaskSourceType.Issue,
            sourceId: id,
            assigneeId: String(issue.assignmentAssignee),
            ...(issue.assignmentDueAt
              ? { dueAt: issue.assignmentDueAt.toISOString() }
              : {}),
          },
          issue.assignmentTaskId,
        );
      } catch (error) {
        task = await this.tasks.findIssueResolutionWork(id);
        if (!task) throw error;
      }
    }
    if (
      String(task._id) !== String(issue.assignmentTaskId) ||
      String(task.assignedTo) !== String(issue.assignmentAssignee) ||
      task.dueAt?.getTime() !== issue.assignmentDueAt?.getTime() ||
      task.title !== issue.assignmentTitle ||
      task.priority !== issue.priority
    )
      throw new ConflictException(
        'Existing source work does not match assignment intent',
      );
    const finished = await this.issues.findOneAndUpdate(
      {
        _id: issue._id,
        status: IssueStatus.Assigning,
        assignmentTaskId: issue.assignmentTaskId,
      },
      {
        $set: {
          status: IssueStatus.Assigned,
          linkedTask: task._id,
          assignedAt: task.assignedAt,
        },
      },
      { new: true, runValidators: true },
    );
    if (!finished)
      throw new ConflictException('Assignment already finalized; reload issue');
    return this.findOne(id, user);
  }

  async close(
    id: string,
    input: CloseIssueDto,
    user: AuthUser,
  ): Promise<IssueDetail> {
    if (!user || !/^[a-fA-F0-9]{24}$/.test(user.id))
      throw new UnauthorizedException();
    if (user.role !== Role.Receptionist && user.role !== Role.Manager)
      throw new ForbiddenException();
    const dto = await this.validateInput(CloseIssueDto, input);
    const issue = await this.operationalIssue(id);
    const validDate = (value: unknown): value is Date =>
      value instanceof Date && Number.isFinite(value.getTime());
    const reviewed =
      issue.reviewedBy instanceof Types.ObjectId &&
      validDate(issue.reviewedAt) &&
      Object.values(HandlingCategory).includes(issue.handlingCategory!) &&
      Object.values(IssuePriority).includes(issue.priority);
    const concluded =
      issue.status === IssueStatus.Concluded &&
      issue.needsStaffAction === false &&
      reviewed &&
      validDate(issue.concludedAt) &&
      issue.concludedAt.getTime() >= issue.reviewedAt!.getTime() &&
      issue.linkedTask === undefined;
    if (!concluded) {
      if (
        issue.status !== IssueStatus.Assigned ||
        issue.needsStaffAction !== true ||
        !reviewed ||
        !(issue.linkedTask instanceof Types.ObjectId)
      )
        throw new ConflictException(
          'Issue resolution is not ready for closure',
        );
      const task = await this.tasks.findIssueResolutionWork(id);
      if (
        !task ||
        String(task._id) !== String(issue.linkedTask) ||
        task.sourceType !== TaskSourceType.Issue ||
        String(task.sourceId) !== String(issue._id) ||
        task.taskType !== 'ISSUE_RESOLUTION' ||
        task.status !== TaskStatus.Completed ||
        !validDate(task.completedAt) ||
        typeof task.workResult !== 'string' ||
        !task.workResult.trim() ||
        task.workResult.trim().length > 2000
      )
        throw new ConflictException(
          'Linked issue resolution work is not completed',
        );
    }
    const snapshot = Object.fromEntries(
      (
        [
          'status',
          'linkedTask',
          'needsStaffAction',
          'handlingCategory',
          'priority',
          'reviewedBy',
          'reviewedAt',
          'reviewNotes',
          'concludedAt',
        ] as const
      ).map((field) => [
        field,
        issue[field] === undefined ? { $exists: false } : issue[field],
      ]),
    );
    const closed = await this.issues.findOneAndUpdate(
      {
        _id: issue._id,
        ...snapshot,
        closedAt: { $exists: false },
        closedBy: { $exists: false },
        closureConclusion: { $exists: false },
      },
      {
        $set: {
          status: IssueStatus.Closed,
          closedAt: new Date(),
          closedBy: new Types.ObjectId(user.id),
          closureConclusion: dto.conclusion,
        },
      },
      { new: true, runValidators: true },
    );
    if (!closed)
      throw new ConflictException('Issue changed; reload before closing');
    return this.findOne(id, user);
  }

  async create(dto: CreateIssueDto, userId: string): Promise<IssueResponse> {
    const context = await this.contexts.resolve(
      userId,
      dto.bookingId,
      dto.roomId,
    );
    const issue = await this.issues.create({
      title: dto.title,
      category: dto.category,
      description: dto.description,
      ...context,
      reporter: new Types.ObjectId(userId),
      priority: IssuePriority.Normal,
      status: IssueStatus.PendingReview,
      reportedAt: new Date(),
    });
    return {
      id: issue._id.toString(),
      title: issue.title,
      category: issue.category,
      description: issue.description,
      priority: issue.priority,
      status: issue.status,
      reportedAt: issue.reportedAt,
      bookingId: issue.booking.toString(),
      ...(issue.room ? { roomId: issue.room.toString() } : {}),
    };
  }
}
