import {
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
import { Issue, IssuePriority, IssueStatus } from './schemas/issue.schema.js';

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
}

export interface IssueRead extends Omit<IssueResponse, 'reportedAt'> {
  reportedAt: string;
  closedAt?: string;
}

export interface IssuesPage {
  items: IssueRead[];
  total: number;
  page: number;
  limit: number;
}

export interface IssueDetail extends IssueRead {
  linkedTasks: [];
  linkedTasksAvailable: false;
}

@Injectable()
export class IssuesService {
  constructor(
    @InjectModel(Issue.name) private readonly issues: Model<Issue>,
    private readonly contexts: IssueContextAdapter,
    @InjectModel(Booking.name) private readonly bookings: Model<Booking>,
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
    booking: 1,
    room: 1,
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
      items: items.map((issue) => this.readResponse(issue)),
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
    return {
      ...this.readResponse(issue),
      linkedTasks: [],
      linkedTasksAvailable: false,
    };
  }

  private readResponse(issue: Issue & { _id: Types.ObjectId }): IssueRead {
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
      ...(issue.closedAt ? { closedAt: issue.closedAt.toISOString() } : {}),
    };
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
