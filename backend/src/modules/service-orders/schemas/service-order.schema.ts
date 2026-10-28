import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types, type HydratedDocument } from 'mongoose';
import { isMoneyVnd } from '../../../common/database/conventions.js';
import {
  ServiceOrderExecutionStatus,
  ServiceOrderReviewStatus,
} from '../service-order-status.js';

export type ServiceOrderDocument = HydratedDocument<ServiceOrder>;

@Schema({ timestamps: true, collection: 'serviceorders' })
export class ServiceOrder {
  // Tuỳ chọn + không immutable: đơn auto-sinh cho khách vãng lai (booking không có
  // customer) để trống, có thể gắn vào tài khoản sau khi khách tạo/đăng nhập.
  @Prop({ type: Types.ObjectId, ref: 'User' })
  customer?: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'Booking',
    required: true,
    immutable: true,
  })
  booking: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'Service',
    required: true,
    immutable: true,
  })
  service: Types.ObjectId;

  @Prop({ required: true, immutable: true })
  serviceName: string;

  @Prop({ immutable: true, default: '' })
  unit: string;

  @Prop({
    required: true,
    min: 1,
    validate: Number.isSafeInteger,
    immutable: true,
  })
  quantity: number;

  @Prop({ required: true, validate: isMoneyVnd, immutable: true })
  unitPriceVND: number;

  @Prop({ required: true, validate: isMoneyVnd, immutable: true })
  amount: number;

  @Prop({ required: true, immutable: true })
  requestedTime: Date;

  @Prop({ immutable: true })
  notes?: string;

  @Prop({
    type: String,
    enum: ServiceOrderReviewStatus,
    default: ServiceOrderReviewStatus.PendingReview,
    required: true,
  })
  reviewStatus: ServiceOrderReviewStatus;

  @Prop({
    type: String,
    enum: ServiceOrderExecutionStatus,
    default: ServiceOrderExecutionStatus.NotStarted,
    required: true,
  })
  executionStatus: ServiceOrderExecutionStatus;

  @Prop({ immutable: true, select: false })
  requestId?: string;

  @Prop({ immutable: true, select: false })
  requestFingerprint?: string;

  @Prop({ type: Types.ObjectId, ref: 'User', select: false })
  reviewedBy?: Types.ObjectId;

  @Prop({ select: false })
  reviewedAt?: Date;

  @Prop({ type: String, enum: ['ACCEPT', 'REJECT'], select: false })
  reviewDecision?: 'ACCEPT' | 'REJECT';

  @Prop({ select: false })
  reviewReason?: string;

  @Prop({ type: Types.ObjectId, ref: 'Invoice', select: false })
  billedInvoiceId?: Types.ObjectId;

  @Prop({ select: false })
  billedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'User', select: false })
  assignmentAssignee?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', select: false })
  assignmentRequestedBy?: Types.ObjectId;

  @Prop({ select: false })
  assignmentRequestedAt?: Date;

  @Prop({ select: false })
  assignmentDueAt?: Date;

  @Prop({ select: false })
  assignmentTitle?: string;

  @Prop({ type: Types.ObjectId, ref: 'Task' })
  assignmentTaskId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Task' })
  linkedTask?: Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;
}

export const ServiceOrderSchema = SchemaFactory.createForClass(ServiceOrder);
ServiceOrderSchema.index(
  { customer: 1, requestId: 1 },
  { unique: true, partialFilterExpression: { requestId: { $exists: true } } },
);
ServiceOrderSchema.index({ customer: 1, booking: 1, createdAt: -1 });
ServiceOrderSchema.index({ reviewStatus: 1, createdAt: -1, _id: -1 });
