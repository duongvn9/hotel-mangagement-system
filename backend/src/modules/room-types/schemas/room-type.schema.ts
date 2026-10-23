import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { isMoneyVnd } from '../../../common/database/conventions.js';

export const validBasePrice = (value: number): boolean => isMoneyVnd(value) && value > 0;

@Schema({ timestamps: true, collection: 'roomtypes' })
export class RoomType {
  @Prop({ required: true, unique: true, trim: true })
  name: string;

  @Prop({ default: '' })
  description: string;

  @Prop({ required: true, min: 1, validate: Number.isSafeInteger })
  capacity: number;

  @Prop({ required: true, validate: validBasePrice })
  basePrice: number;

  @Prop({
    type: [{ type: Types.ObjectId, ref: 'Amenity' }],
    default: [],
    validate: (values: Types.ObjectId[]) => new Set(values.map(String)).size === values.length,
  })
  amenities: Types.ObjectId[];

  @Prop({ default: true })
  isActive: boolean;
}

export const RoomTypeSchema = SchemaFactory.createForClass(RoomType);
