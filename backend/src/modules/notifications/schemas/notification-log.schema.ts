import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types, type HydratedDocument } from 'mongoose';
import type { NotificationTemplate } from '../notification.types.js';

export enum NotificationLogStatus {
  Pending = 'PENDING',
  Sent = 'SENT',
  Failed = 'FAILED',
}

export type NotificationLogDocument = HydratedDocument<NotificationLog>;

@Schema({ timestamps: true, collection: 'notificationlogs' })
export class NotificationLog {
  @Prop({ type: String, required: true })
  type: NotificationTemplate;

  @Prop({ required: true, trim: true })
  recipient: string;

  @Prop({ type: Types.ObjectId, ref: 'Booking' })
  relatedBookingId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'PaymentTransaction' })
  relatedPaymentId?: Types.ObjectId;

  @Prop({ type: String, enum: NotificationLogStatus, required: true })
  status: NotificationLogStatus;

  @Prop({ type: Number, min: 0, default: 0 })
  retryCount: number;

  @Prop({ type: String })
  lastError?: string;

  @Prop({ type: String, required: true })
  subject: string;

  @Prop({ type: Object, required: true })
  payload: { html: string; text: string };

  @Prop({ type: Date })
  sentAt?: Date;

  @Prop({ type: Date })
  nextRetryAt?: Date;

  @Prop({ required: true, unique: true, trim: true })
  idempotencyKey: string;
}

export const NotificationLogSchema =
  SchemaFactory.createForClass(NotificationLog);
