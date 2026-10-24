import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

export enum IssueStatus {
  PendingReview = 'PENDING_REVIEW',
}

export enum IssuePriority {
  Normal = 'NORMAL',
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

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  reporter: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Booking', required: true })
  booking: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Room' })
  room?: Types.ObjectId;
}

export const IssueSchema = SchemaFactory.createForClass(Issue);
IssueSchema.index({ reporter: 1, reportedAt: -1 });
IssueSchema.index({ booking: 1 });
