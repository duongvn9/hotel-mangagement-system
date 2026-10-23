import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types, type HydratedDocument } from 'mongoose';
import { isMoneyVnd } from '../../../common/database/conventions.js';
import { InvoiceCharge, InvoiceChargeSchema } from './invoice-charge.schema.js';

export enum InvoiceStatus {
  Unpaid = 'UNPAID',
  PartiallyPaid = 'PARTIALLY_PAID',
  Paid = 'PAID',
}

export type InvoiceDocument = HydratedDocument<Invoice>;

@Schema({ timestamps: true, collection: 'invoices', optimisticConcurrency: true })
export class Invoice {
  @Prop({ type: Types.ObjectId, ref: 'Booking', required: true, unique: true })
  booking: Types.ObjectId;

  @Prop({ required: true, unique: true, trim: true })
  code: string;

  @Prop({ required: true, default: 0, validate: isMoneyVnd })
  roomTotal: number;

  @Prop({ required: true, default: 0, validate: isMoneyVnd })
  serviceTotal: number;

  @Prop({ required: true, default: 0, validate: isMoneyVnd })
  additionalTotal: number;

  @Prop({ required: true, default: 0, validate: isMoneyVnd })
  discountTotal: number;

  @Prop({ required: true, default: 0, validate: isMoneyVnd })
  taxTotal: number;

  @Prop({ required: true, default: 0, validate: isMoneyVnd })
  totalAmount: number;

  @Prop({ required: true, default: 0, validate: isMoneyVnd })
  depositPaid: number;

  @Prop({ required: true, default: 0, validate: isMoneyVnd })
  finalPaid: number;

  @Prop({ required: true, default: 0, validate: isMoneyVnd })
  balanceDue: number;

  @Prop({ type: String, required: true, enum: InvoiceStatus, default: InvoiceStatus.Unpaid })
  status: InvoiceStatus;

  @Prop({ type: [InvoiceChargeSchema], default: [] })
  charges: InvoiceCharge[];

  @Prop({ default: true })
  isActive: boolean;
}

export const InvoiceSchema = SchemaFactory.createForClass(Invoice);
InvoiceSchema.pre('validate', function () {
  const sources = this.charges.map((charge) => charge.sourceId).filter((source) => source !== undefined);
  if (new Set(sources).size !== sources.length) {
    this.invalidate('charges', 'Charge source identifiers must be unique within an invoice');
  }
  const total = this.roomTotal + this.serviceTotal + this.additionalTotal + this.taxTotal - this.discountTotal;
  if (!isMoneyVnd(total) || total !== this.totalAmount) {
    this.invalidate('totalAmount', 'Total must match the financial breakdown');
  }
  const paid = this.depositPaid + this.finalPaid;
  if (!isMoneyVnd(paid) || this.totalAmount - paid !== this.balanceDue) {
    this.invalidate('balanceDue', 'Balance must equal total minus payments');
  }
});
