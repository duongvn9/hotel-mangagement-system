import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Types, type Model } from 'mongoose';
import { User } from '../users/schemas/user.schema.js';
import type { ListFeedbackQuery } from './dto/feedback.dto.js';
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
  ) {}

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
