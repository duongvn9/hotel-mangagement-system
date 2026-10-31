import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

export enum IssueStatus {
  PendingReview = 'PENDING_REVIEW',
  Reviewed = 'REVIEWED',
  Assigning = 'ASSIGNING',
  Assigned = 'ASSIGNED',
  Concluded = 'CONCLUDED',
  Closed = 'CLOSED',
}

export enum HandlingCategory {
  Service = 'SERVICE',
  Operations = 'OPERATIONS',
}

export enum IssuePriority {
  Low = 'LOW',
  Normal = 'NORMAL',
  High = 'HIGH',
  Urgent = 'URGENT',
}

export interface ReassignmentIntent {
  requestId: string;
  taskId: string;
  taskRevision: number;
  targetTaskId: string;
  assigneeId: string;
  reason: string;
  dueAt?: string;
  actorId: string;
  requestedAt: string;
  recoveryActors: string[];
  abandonedTargets: string[];
}

@Schema({ timestamps: true, collection: 'issues' })
export class Issue {
  @Prop({ required: true, trim: true, minlength: 1, maxlength: 200 })
  title: string;

  @Prop({ required: true, trim: true, minlength: 1, maxlength: 100 })
  category: string;

  @Prop({ required: true, trim: true, minlength: 1, maxlength: 5000 })
  description: string;

  @Prop({
    type: String,
    enum: IssuePriority,
    required: true,
    default: IssuePriority.Normal,
  })
  priority: IssuePriority;

  @Prop({
    type: String,
    enum: IssueStatus,
    required: true,
    default: IssueStatus.PendingReview,
  })
  status: IssueStatus;

  @Prop({ required: true, default: Date.now })
  reportedAt: Date;

  @Prop()
  closedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  closedBy?: Types.ObjectId;

  @Prop({ trim: true, minlength: 1, maxlength: 2000 })
  closureConclusion?: string;

  @Prop({ type: String, enum: HandlingCategory })
  handlingCategory?: HandlingCategory;

  @Prop()
  needsStaffAction?: boolean;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  reviewedBy?: Types.ObjectId;

  @Prop()
  reviewedAt?: Date;

  @Prop({ maxlength: 2000 })
  reviewNotes?: string;

  @Prop()
  concludedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  assignmentRequestedBy?: Types.ObjectId;

  @Prop()
  assignmentRequestedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  assignmentAssignee?: Types.ObjectId;

  @Prop()
  assignmentDueAt?: Date;

  @Prop({ minlength: 1, maxlength: 2000 })
  assignmentInstructions?: string;

  @Prop()
  assignmentTitle?: string;

  @Prop({ type: Types.ObjectId })
  assignmentTaskId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Task' })
  linkedTask?: Types.ObjectId;

  @Prop()
  assignedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  reporter: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Booking', required: true })
  booking: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Room' })
  room?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'ServiceOrder' })
  serviceOrder?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Task' })
  sourceTask?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Service' })
  service?: Types.ObjectId;

  @Prop({ type: Object })
  pendingReassignment?: ReassignmentIntent;

  @Prop({ type: [Object], default: [] })
  reassignmentHistory?: (ReassignmentIntent & { completedAt: string })[];

  @Prop({ select: false })
  requestId?: string;

  @Prop({ select: false })
  requestFingerprint?: string;
}

export const IssueSchema = SchemaFactory.createForClass(Issue);
IssueSchema.index({ reporter: 1, reportedAt: -1 });
IssueSchema.index({ booking: 1 });
export const ISSUE_REQUEST_INDEX = {
  name: 'unique_issue_reporter_request',
  unique: true,
  partialFilterExpression: { requestId: { $type: 'string' } },
};
IssueSchema.index({ reporter: 1, requestId: 1 }, ISSUE_REQUEST_INDEX);
