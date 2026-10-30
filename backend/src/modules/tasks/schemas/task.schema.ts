import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types, type HydratedDocument } from 'mongoose';
import { TaskSourceType, TaskStatus } from '../task-contract.js';

export { TaskSourceType, TaskStatus };
export type TaskDocument = HydratedDocument<Task>;

@Schema({ timestamps: true, collection: 'tasks' })
export class Task {
  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ required: true, trim: true })
  taskType: string;

  @Prop({ required: true, trim: true })
  priority: string;

  @Prop({
    type: String,
    enum: TaskStatus,
    required: true,
    default: TaskStatus.Assigned,
  })
  status: TaskStatus;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  assignedTo: Types.ObjectId;

  @Prop({ required: true, default: Date.now })
  assignedAt: Date;

  @Prop()
  dueAt?: Date;

  @Prop()
  completedAt?: Date;

  @Prop({ trim: true })
  workResult?: string;

  @Prop({ default: false })
  blocked?: boolean;

  @Prop({ default: 0 })
  revision?: number;

  @Prop({ type: [Object], default: [] })
  blockerHistory?: {
    id: string;
    reason: string;
    reportedBy: string;
    reportedAt: Date;
    resolvedAt?: Date;
    resolvedBy?: string;
    resolution?: string;
  }[];

  @Prop({ maxlength: 2000 })
  instructions?: string;

  @Prop({ type: [Object], default: [] })
  continuationHistory?: {
    actorId: string;
    at: Date;
    dueAt?: Date;
    instructions?: string;
  }[];

  @Prop({ type: Object })
  cancellation?: {
    reason: string;
    actorId: string;
    recoveryActorId: string;
    at: Date;
    requestId: string;
    replacementTaskId?: string;
  };

  @Prop({ type: String, enum: TaskSourceType, required: true })
  sourceType: TaskSourceType;

  @Prop({ type: Types.ObjectId, required: true })
  sourceId: Types.ObjectId;
}

export const TaskSchema = SchemaFactory.createForClass(Task);
TaskSchema.index({ assignedTo: 1, status: 1 });
TaskSchema.index({ status: 1 });
TaskSchema.index({ sourceType: 1, sourceId: 1 });
TaskSchema.index(
  { sourceType: 1, sourceId: 1, taskType: 1 },
  {
    name: 'unique_active_task_work',
    unique: true,
    partialFilterExpression: {
      status: { $in: [TaskStatus.Assigned, TaskStatus.InProgress] },
    },
  },
);
