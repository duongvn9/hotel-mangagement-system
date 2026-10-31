import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema, type Types } from 'mongoose';
import { EquipmentCondition } from '../../../common/constants/equipment-condition.enum.js';

@Schema({ timestamps: true, collection: 'equipment' })
export class Equipment {
  @Prop()
  imageUrl?: string;

  @Prop({ required: true, trim: true, unique: true }) assetCode: string;
  @Prop({ required: true, trim: true }) name: string;
  @Prop({ required: true, trim: true }) category: string;
  @Prop({ trim: true, default: '' }) location: string;
  @Prop({
    type: String,
    enum: EquipmentCondition,
    default: EquipmentCondition.Good,
  })
  condition: EquipmentCondition;
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Room' })
  room?: Types.ObjectId;
  @Prop({ default: true }) isActive: boolean;
}
export const EquipmentSchema = SchemaFactory.createForClass(Equipment);
