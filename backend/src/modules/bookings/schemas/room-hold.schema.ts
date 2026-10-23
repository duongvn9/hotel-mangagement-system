import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types, type HydratedDocument } from 'mongoose';
import { validRooms } from './booking.schema.js';

export type RoomHoldDocument = HydratedDocument<RoomHold>;

@Schema({ timestamps: true, collection: 'roomholds' })
export class RoomHold {
  @Prop({ type: Types.ObjectId, ref: 'Booking', required: true, unique: true })
  booking: Types.ObjectId;

  @Prop({
    type: [{ type: Types.ObjectId, ref: 'Room' }],
    required: true,
    validate: validRooms,
  })
  rooms: Types.ObjectId[];

  @Prop({ required: true })
  checkIn: Date;

  @Prop({
    required: true,
    validate: function (this: RoomHold, value: Date) {
      return value > this.checkIn;
    },
  })
  checkOut: Date;

  @Prop({ required: true })
  expiresAt: Date;

  @Prop({ default: true })
  isActive: boolean;
}

export const RoomHoldSchema = SchemaFactory.createForClass(RoomHold);
RoomHoldSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
RoomHoldSchema.index({
  rooms: 1,
  isActive: 1,
  expiresAt: 1,
  checkIn: 1,
  checkOut: 1,
});
