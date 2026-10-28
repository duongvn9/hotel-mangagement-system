import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types, type HydratedDocument } from 'mongoose';
import { BookingStatus } from '../../../common/constants/booking-status.enum.js';
import { BookingSource } from '../../../common/constants/booking-source.enum.js';
import { isMoneyVnd } from '../../../common/database/conventions.js';

export { BookingStatus, BookingSource };
export type BookingDocument = HydratedDocument<Booking>;

export const validRooms = (rooms: Types.ObjectId[]): boolean =>
  Array.isArray(rooms) &&
  rooms.length > 0 &&
  rooms.every((room) => room instanceof Types.ObjectId) &&
  new Set(rooms.map(String)).size === rooms.length;

@Schema({ timestamps: true, collection: 'bookings' })
export class Booking {
  @Prop({ required: true, unique: true, trim: true })
  code: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  customer?: Types.ObjectId;

  @Prop({ required: true, trim: true })
  guestName: string;

  @Prop({ required: true, trim: true })
  guestEmail: string;

  @Prop({ required: true, trim: true })
  guestPhone: string;

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
    validate: function (this: Booking, value: Date) {
      return value > this.checkIn;
    },
  })
  checkOut: Date;

  @Prop({ required: true, min: 1, validate: Number.isSafeInteger })
  adultCount: number;

  @Prop({ required: true, min: 0, default: 0, validate: Number.isSafeInteger })
  childCount: number;

  @Prop({
    type: String,
    enum: BookingSource,
    required: true,
    default: BookingSource.Online,
  })
  source: BookingSource;

  @Prop({
    type: String,
    enum: BookingStatus,
    required: true,
    default: BookingStatus.PendingDeposit,
  })
  status: BookingStatus;

  @Prop({ required: true, validate: isMoneyVnd })
  roomTotal: number;

  @Prop({ required: true, validate: isMoneyVnd })
  depositAmount: number;

  // Đơn giá/đêm từng phòng chốt lúc đặt, để H7 tính lại kiểm chứng (không lệ thuộc giá RoomType đổi sau).
  @Prop({
    type: [
      {
        _id: false,
        room: { type: Types.ObjectId, ref: 'Room', required: true },
        ratePerNight: { type: Number, required: true, validate: isMoneyVnd },
      },
    ],
    default: [],
  })
  rateSnapshot: { room: Types.ObjectId; ratePerNight: number }[];

  @Prop()
  checkedInAt?: Date;

  @Prop()
  checkedOutAt?: Date;

  @Prop()
  cancelledAt?: Date;

  @Prop({ default: true })
  isActive: boolean;
}

export const BookingSchema = SchemaFactory.createForClass(Booking);
BookingSchema.index({
  rooms: 1,
  status: 1,
  checkIn: 1,
  checkOut: 1,
  isActive: 1,
});
BookingSchema.index({ customer: 1, createdAt: -1 });
