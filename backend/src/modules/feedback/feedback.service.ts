import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Types, type Model } from 'mongoose';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { Booking, BookingStatus } from '../bookings/schemas/booking.schema.js';
import { User } from '../users/schemas/user.schema.js';
import type {
  ListFeedbackQuery,
  MyStaysResponse,
  SubmitFeedbackDto,
  SubmittedFeedback,
} from './dto/feedback.dto.js';
import { Feedback } from './schemas/feedback.schema.js';

interface PopulatedUser {
  _id: Types.ObjectId;
  fullName: string;
  email: string;
}

type PopulatedFeedback = Omit<Feedback, 'customer' | 'reply'> & {
  _id: Types.ObjectId;
  createdAt?: Date;
  customer: PopulatedUser | null;
  reply?: { content: string; repliedAt: Date; repliedBy: PopulatedUser | null };
};

const toFeedback = (f: PopulatedFeedback) => ({
  id: String(f._id),
  bookingId: String(f.booking),
  rating: f.rating,
  content: f.content,
  createdAt: f.createdAt,
  customer: f.customer && {
    id: String(f.customer._id),
    fullName: f.customer.fullName,
    email: f.customer.email,
  },
  reply: f.reply && {
    content: f.reply.content,
    repliedAt: f.reply.repliedAt,
    repliedBy: f.reply.repliedBy && {
      id: String(f.reply.repliedBy._id),
      fullName: f.reply.repliedBy.fullName,
    },
  },
});

const escapeRegex = (text: string) =>
  text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const POPULATE = [
  { path: 'customer', select: 'fullName email' },
  { path: 'reply.repliedBy', select: 'fullName' },
];

@Injectable()
export class FeedbackService {
  constructor(
    @InjectModel(Feedback.name) private readonly feedback: Model<Feedback>,
    @InjectModel(User.name) private readonly users: Model<User>,
    @InjectModel(Booking.name) private readonly bookings: Model<Booking>,
  ) {}

  /**
   * UC39 Submit Feedback: khách gửi phản hồi cho lần lưu trú đã trả phòng của chính mình
   * (BR-FB-01), điểm 1-5 không bắt buộc (BR-FB-02), mỗi booking một phản hồi (BR-FB-03).
   */
  async submit(
    dto: SubmitFeedbackDto,
    user: AuthUser,
  ): Promise<SubmittedFeedback> {
    const booking = await this.bookings
      .findById(dto.bookingId)
      .select('customer status isActive')
      .lean();
    if (!booking || !booking.isActive) {
      throw new NotFoundException('Booking not found');
    }
    if (!booking.customer || String(booking.customer) !== user.id) {
      throw new ForbiddenException('Not your booking');
    }
    if (booking.status !== BookingStatus.CheckedOut) {
      throw new ConflictException('Feedback can only be sent after check-out');
    }
    try {
      const created = await this.feedback.create({
        customer: booking.customer,
        booking: booking._id,
        content: dto.content,
        ...(dto.rating === undefined ? {} : { rating: dto.rating }),
      });
      return {
        id: String(created._id),
        bookingId: String(created.booking),
        ...(created.rating === undefined ? {} : { rating: created.rating }),
        content: created.content,
        createdAt: (
          (created as { createdAt?: Date }).createdAt ?? new Date()
        ).toISOString(),
      };
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        throw new ConflictException(
          'Feedback for this stay has already been sent',
        );
      }
      throw error;
    }
  }

  /** Các lần lưu trú đã trả phòng của khách kèm phản hồi đã gửi và câu trả lời của lễ tân. */
  async mine(user: AuthUser): Promise<MyStaysResponse> {
    const customer = new Types.ObjectId(user.id);
    const stays = await this.bookings
      .find({ customer, status: BookingStatus.CheckedOut, isActive: true })
      .sort({ checkOut: -1, _id: -1 })
      .select('code checkIn checkOut')
      .lean();
    const sent = await this.feedback
      .find({
        customer,
        booking: { $in: stays.map((stay) => stay._id) },
        isActive: true,
      })
      .lean<(Feedback & { _id: Types.ObjectId; createdAt?: Date })[]>();
    const byBooking = new Map(sent.map((item) => [String(item.booking), item]));
    return {
      items: stays.map((stay) => {
        const item = byBooking.get(String(stay._id));
        return {
          bookingId: String(stay._id),
          code: stay.code,
          checkIn: stay.checkIn.toISOString(),
          checkOut: stay.checkOut.toISOString(),
          feedback: item
            ? {
                id: String(item._id),
                ...(item.rating === undefined ? {} : { rating: item.rating }),
                content: item.content,
                createdAt: (item.createdAt ?? new Date(0)).toISOString(),
                ...(item.reply
                  ? {
                      reply: {
                        content: item.reply.content,
                        repliedAt: item.reply.repliedAt.toISOString(),
                      },
                    }
                  : {}),
              }
            : null,
        };
      }),
    };
  }

  /** UC40 View Feedback List. */
  async list({ search, rating, replied, page, limit }: ListFeedbackQuery) {
    const filter: Record<string, unknown> = { isActive: true };
    if (rating) filter.rating = rating;
    if (replied !== undefined) filter.reply = { $exists: replied };
    if (search?.trim()) {
      const pattern = new RegExp(escapeRegex(search.trim()), 'i');
      const customers = await this.users
        .find({ $or: [{ fullName: pattern }, { email: pattern }] })
        .distinct('_id');
      filter.$or = [{ content: pattern }, { customer: { $in: customers } }];
    }
    const [items, total] = await Promise.all([
      this.feedback
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate(POPULATE)
        .lean<PopulatedFeedback[]>(),
      this.feedback.countDocuments(filter),
    ]);
    return { items: items.map(toFeedback), total, page, limit };
  }

  async findOne(id: string) {
    const feedback = isValidObjectId(id)
      ? await this.feedback
          .findOne({ _id: id, isActive: true })
          .populate(POPULATE)
          .lean<PopulatedFeedback>()
      : null;
    if (!feedback) throw new NotFoundException('Không tìm thấy phản hồi');
    return toFeedback(feedback);
  }

  /** UC41 Reply to Feedback: mỗi phản hồi có một câu trả lời chính thức. */
  async reply(id: string, content: string, receptionistId: string) {
    const updated = isValidObjectId(id)
      ? await this.feedback.findOneAndUpdate(
          { _id: id, isActive: true, reply: { $exists: false } },
          {
            $set: {
              reply: {
                content,
                repliedBy: new Types.ObjectId(receptionistId),
                repliedAt: new Date(),
              },
            },
          },
          { new: true },
        )
      : null;
    if (!updated) {
      // Phân biệt "không còn tồn tại" (UC41 luồng phụ bước 2) với "đã trả lời rồi".
      const exists =
        isValidObjectId(id) &&
        (await this.feedback.exists({ _id: id, isActive: true }));
      if (!exists) {
        throw new NotFoundException(
          'Phản hồi không còn tồn tại, không thể trả lời',
        );
      }
      throw new ConflictException('Phản hồi này đã được trả lời');
    }
    return this.findOne(id);
  }
}
