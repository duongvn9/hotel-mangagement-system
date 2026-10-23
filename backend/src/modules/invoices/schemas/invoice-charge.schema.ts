import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { isMoneyVnd } from '../../../common/database/conventions.js';

export enum InvoiceChargeType {
  Service = 'SERVICE',
  Additional = 'ADDITIONAL',
  Discount = 'DISCOUNT',
  Tax = 'TAX',
}

@Schema({ _id: false })
export class InvoiceCharge {
  @Prop({ type: String, required: true, enum: InvoiceChargeType })
  type: InvoiceChargeType;

  @Prop({ required: true, validate: isMoneyVnd })
  amount: number;

  @Prop({ required: true, trim: true })
  reason: string;

  @Prop({ trim: true, minlength: 1 })
  sourceId?: string;

  @Prop({
    type: Boolean,
    required: true,
    validate: (value: boolean) => value === true,
  })
  approved: true;
}

export const InvoiceChargeSchema = SchemaFactory.createForClass(InvoiceCharge);
