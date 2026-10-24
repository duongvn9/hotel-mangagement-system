import { Injectable } from '@nestjs/common';
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

@Injectable()
export class IssuesService {
  constructor(
    @InjectModel(Issue.name) private readonly issues: Model<Issue>,
    private readonly contexts: IssueContextAdapter,
  ) {}

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
