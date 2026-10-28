import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types, type HydratedDocument } from 'mongoose';
import { validRooms } from './booking.schema.js';

export type RoomHoldDocument = HydratedDocument<RoomHold>;

@Schema({ timestamps: true, collection: 'roomholds' })
export class RoomHold {
  @Prop({ type: Types.ObjectId, ref: 'Booking', required: true, unique: true })
  booking: Types.ObjectId;

  /** Mã giữ phòng cấp cho client; dùng để tiếp tục/nhả hold mà không lộ booking id. */
  @Prop({ required: true, unique: true, trim: true })
  holdToken: string;

  /** Phiên khách (cookie HttpOnly) tạo hold; để chống lạm dụng (1 hold/phiên, rate). */
  @Prop({ trim: true, index: true })
  sessionId?: string;

  /** IP client lúc tạo hold; chỉ để rate-limit, không thay chống đua ở DB. */
  @Prop({ trim: true })
  clientIp?: string;

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

  /** Hết hạn giữ phòng. Backend chủ động nhả khi quá hạn (không dùng TTL tự xoá). */
  @Prop({ required: true })
  expiresAt: Date;

  @Prop({ default: true })
  isActive: boolean;
}

export const RoomHoldSchema = SchemaFactory.createForClass(RoomHold);
// Giữ bản ghi hold kể cả khi hết hạn (nhả bằng isActive=false) để phục vụ rate-limit
// và theo dõi hành vi; không TTL tự xoá như bản trước.
RoomHoldSchema.index({
  rooms: 1,
  isActive: 1,
  expiresAt: 1,
  checkIn: 1,
  checkOut: 1,
});
RoomHoldSchema.index({ sessionId: 1, createdAt: -1 });
