import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { RoomStatus } from '../../../common/constants/room-status.enum.js';

@Schema({ timestamps: true, collection: 'rooms' })
export class Room {
  @Prop({ required: true, trim: true, unique: true })
  roomNumber: string;

  @Prop({ required: true, validate: Number.isSafeInteger })
  floor: number;

  @Prop({ type: Types.ObjectId, ref: 'RoomType', required: true })
  roomType: Types.ObjectId;

  @Prop({ required: true, enum: RoomStatus, default: RoomStatus.Available })
  status: RoomStatus;

  @Prop({ trim: true, default: '' })
  notes: string;

  @Prop({ default: true })
  isActive: boolean;
}

export const RoomSchema = SchemaFactory.createForClass(Room);
