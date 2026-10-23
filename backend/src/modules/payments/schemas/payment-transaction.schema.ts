import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types, type HydratedDocument } from 'mongoose';
import { isMoneyVnd } from '../../../common/database/conventions.js';

export enum PaymentStatus {
  Pending = 'PENDING',
  Success = 'SUCCESS',
  Failed = 'FAILED',
  Cancelled = 'CANCELLED',
}

export enum PaymentPurpose {
  Deposit = 'DEPOSIT',
  Final = 'FINAL',
}

export enum PaymentMethod {
  Vnpay = 'VNPAY',
  Cash = 'CASH',
}

export type PaymentTransactionDocument = HydratedDocument<PaymentTransaction>;

@Schema({ timestamps: true, collection: 'paymenttransactions' })
export class PaymentTransaction {
  @Prop({ type: Types.ObjectId, ref: 'Booking', required: true, index: true })
  booking: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Invoice', required: true, index: true })
  invoice: Types.ObjectId;

  @Prop({ required: true, unique: true, trim: true })
  transactionRef: string;

  @Prop({ trim: true, minlength: 1 })
  providerTransactionRef?: string;

  @Prop({ type: String, required: true, enum: PaymentMethod })
  method: PaymentMethod;

  @Prop({ type: String, required: true, enum: PaymentPurpose })
  purpose: PaymentPurpose;

  @Prop({
    type: String,
    required: true,
    enum: PaymentStatus,
    default: PaymentStatus.Pending,
  })
  status: PaymentStatus;

  @Prop({ required: true, validate: isMoneyVnd })
  amount: number;

  @Prop()
  paidAt?: Date;

  @Prop({ default: true })
  isActive: boolean;
}

export const PaymentTransactionSchema =
  SchemaFactory.createForClass(PaymentTransaction);
PaymentTransactionSchema.index(
  { method: 1, providerTransactionRef: 1 },
  {
    unique: true,
    partialFilterExpression: { providerTransactionRef: { $type: 'string' } },
  },
);
