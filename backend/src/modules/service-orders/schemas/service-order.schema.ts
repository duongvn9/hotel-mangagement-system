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

  @Prop({
    type: {
      _id: false,
      decision: { type: String, enum: ['REJECT'], required: true },
      action: { type: String, enum: ['ABANDON_EXPIRED'] },
      actorRole: { type: String, enum: ['RECEPTIONIST'] },
      previousReviewStatus: { type: String, enum: ['ACCEPTING'] },
      resultingReviewStatus: { type: String, enum: ['ABANDONED'] },
      evidence: {
        type: {
          _id: false,
          chargeExpected: { type: Boolean, required: true },
          sourceChargeAbsent: { type: Boolean, required: true },
          taskAbsent: { type: Boolean, required: true },
          bookingStatus: String,
          checkIn: Date,
          checkOut: Date,
          requestedTime: Date,
          reviewedBy: Types.ObjectId,
          reviewedAt: Date,
          reviewDecision: String,
          reviewReason: String,
          quantity: Number,
          unitPriceVND: Number,
          amount: Number,
        },
        default: undefined,
      },
      reason: { type: String, required: true },
      rejectionReason: { type: String, required: true },
      actor: { type: Types.ObjectId, ref: 'User', required: true },
      at: { type: Date, required: true },
    },
    default: undefined,
    select: false,
  })
  acceptanceRecovery?: {
    decision: 'REJECT';
    action?: 'ABANDON_EXPIRED';
    actorRole?: 'RECEPTIONIST';
    previousReviewStatus?: 'ACCEPTING';
    resultingReviewStatus?: 'ABANDONED';
    evidence?: {
      chargeExpected: boolean;
      sourceChargeAbsent: boolean;
      taskAbsent: boolean;
      bookingStatus?: string;
      checkIn?: Date;
      checkOut?: Date;
      requestedTime?: Date;
      reviewedBy?: Types.ObjectId;
      reviewedAt?: Date;
      reviewDecision?: string;
      reviewReason?: string;
      quantity?: number;
      unitPriceVND?: number;
      amount?: number;
    };
    reason: string;
    rejectionReason: string;
    actor: Types.ObjectId;
    at: Date;
  };

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

  @Prop({
    type: [
      {
        _id: false,
        actor: { type: Types.ObjectId, ref: 'User', required: true },
        at: { type: Date, required: true },
        previousAssignee: { type: Types.ObjectId, ref: 'User', required: true },
        assignee: { type: Types.ObjectId, ref: 'User', required: true },
        reason: { type: String, required: true },
      },
    ],
    default: undefined,
    select: false,
  })
  assignmentRecoveryAudit?: {
    actor: Types.ObjectId;
    at: Date;
    previousAssignee: Types.ObjectId;
    assignee: Types.ObjectId;
    reason: string;
  }[];

  @Prop({ type: Types.ObjectId, ref: 'Task' })
  assignmentTaskId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Task' })
  linkedTask?: Types.ObjectId;

  @Prop({ immutable: true })
  intakeMode?: string;

  @Prop({ immutable: true, select: false })
  intakeKey?: string;

  @Prop({ immutable: true, select: false })
  intakeFingerprint?: string;

  @Prop({ type: Types.ObjectId, ref: 'User', immutable: true })
  createdBy?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', immutable: true })
  reportedBy?: Types.ObjectId;

  @Prop({ immutable: true })
  intakeRole?: string;

  @Prop({ immutable: true })
  requesterName?: string;

  @Prop({ type: Types.ObjectId, ref: 'Room', immutable: true })
  room?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', immutable: true })
  actualPerformer?: Types.ObjectId;

  @Prop({ immutable: true })
  actualCompletedAt?: Date;

  @Prop({ immutable: true })
  completionDetails?: string;

  createdAt: Date;
  updatedAt: Date;
}

export const ServiceOrderSchema = SchemaFactory.createForClass(ServiceOrder);
ServiceOrderSchema.index(
  { customer: 1, requestId: 1 },
  { unique: true, partialFilterExpression: { requestId: { $exists: true } } },
);
ServiceOrderSchema.index(
  { intakeKey: 1 },
  { unique: true, partialFilterExpression: { intakeKey: { $exists: true } } },
);
ServiceOrderSchema.index({ reportedBy: 1, createdAt: -1 });
ServiceOrderSchema.index({ customer: 1, booking: 1, createdAt: -1 });
ServiceOrderSchema.index({ reviewStatus: 1, createdAt: -1, _id: -1 });
