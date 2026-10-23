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

  @Prop({ type: String, enum: TaskStatus, required: true, default: TaskStatus.Assigned })
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

  @Prop({ type: String, enum: TaskSourceType, required: true })
  sourceType: TaskSourceType;

  @Prop({ type: Types.ObjectId, required: true })
  sourceId: Types.ObjectId;
}

export const TaskSchema = SchemaFactory.createForClass(Task);
TaskSchema.index({ assignedTo: 1, status: 1 });
TaskSchema.index({ status: 1 });
TaskSchema.index({ sourceType: 1, sourceId: 1 });
