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
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, immutable: true })
  customer: Types.ObjectId;

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

  createdAt: Date;
  updatedAt: Date;
}

export const ServiceOrderSchema = SchemaFactory.createForClass(ServiceOrder);
ServiceOrderSchema.index(
  { customer: 1, requestId: 1 },
  { unique: true, partialFilterExpression: { requestId: { $exists: true } } },
);
ServiceOrderSchema.index({ customer: 1, booking: 1, createdAt: -1 });
