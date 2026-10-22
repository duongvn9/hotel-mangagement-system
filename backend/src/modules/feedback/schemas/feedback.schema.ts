import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types, type HydratedDocument } from 'mongoose';

export type FeedbackDocument = HydratedDocument<Feedback>;

/** Câu trả lời chính thức của Lễ tân (UC41). */
@Schema({ _id: false })
export class FeedbackReply {
  @Prop({ required: true, trim: true, maxlength: 2000 })
  content: string;

  /** BR-FB-06: giữ người trả lời và thời điểm trả lời. */
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  repliedBy: Types.ObjectId;

  @Prop({ required: true })
  repliedAt: Date;
}

/**
 * Phản hồi của Customer cho một lần lưu trú (collection `feedbacks`).
 * Hợp đồng dùng chung: UC39 Submit Feedback (Khoa) tạo bản ghi, UC40-41 (Dương) xem và trả lời.
 */
@Schema({ timestamps: true })
export class Feedback {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  customer: Types.ObjectId;

  /** Lần lưu trú được phản hồi (BR-FB-01). */
  @Prop({ type: Types.ObjectId, ref: 'Booking', required: true })
  booking: Types.ObjectId;

  /** BR-FB-02: 1-5 sao, không bắt buộc. */
  @Prop({ min: 1, max: 5 })
  rating?: number;

  @Prop({ required: true, trim: true, maxlength: 2000 })
  content: string;

  @Prop({ type: FeedbackReply })
  reply?: FeedbackReply;

  @Prop({ default: true })
  isActive: boolean;
}

export const FeedbackSchema = SchemaFactory.createForClass(Feedback);
// BR-FB-03: mỗi Customer một phản hồi cho mỗi booking.
FeedbackSchema.index({ customer: 1, booking: 1 }, { unique: true });
