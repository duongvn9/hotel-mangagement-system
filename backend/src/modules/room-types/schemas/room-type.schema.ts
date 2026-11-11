import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { isMoneyVnd } from '../../../common/database/conventions.js';

export const validBasePrice = (value: number): boolean =>
  isMoneyVnd(value) && value > 0;

export const validAdultCapacity = (value: number): boolean =>
  Number.isSafeInteger(value) && value >= 1;
export const validChildCapacity = (value: number): boolean =>
  Number.isSafeInteger(value) && value >= 0;

@Schema({ timestamps: true, collection: 'roomtypes' })
export class RoomType {
  @Prop({ type: [String], default: [] })
  images: string[];

  @Prop({ required: true, unique: true, trim: true })
  name: string;

  @Prop({ default: '' })
  description: string;

  @Prop({ required: true, min: 1, validate: Number.isSafeInteger })
  adultCapacity: number;

  @Prop({ required: true, min: 0, validate: Number.isSafeInteger })
  childCapacity: number;

  @Prop({ required: true, validate: validBasePrice })
  basePrice: number;

  @Prop({
    type: [{ type: Types.ObjectId, ref: 'Amenity' }],
    default: [],
    validate: (values: Types.ObjectId[]) =>
      new Set(values.map(String)).size === values.length,
  })
  amenities: Types.ObjectId[];

  @Prop({
    type: [
      {
        _id: false,
        bedType: { type: Types.ObjectId, ref: 'BedType', required: true },
        quantity: {
          type: Number,
          required: true,
          min: 1,
          max: 20,
          validate: Number.isSafeInteger,
        },
      },
    ],
    default: [],
    validate: (values: { bedType: Types.ObjectId }[]) =>
      new Set(values.map((value) => String(value.bedType))).size ===
      values.length,
  })
  beds: { bedType: Types.ObjectId; quantity: number }[];

  @Prop({ default: true })
  isActive: boolean;
}

export const RoomTypeSchema = SchemaFactory.createForClass(RoomType);
RoomTypeSchema.index({ amenities: 1 });
RoomTypeSchema.index({ 'beds.bedType': 1 });
