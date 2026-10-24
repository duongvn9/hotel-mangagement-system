import { Logger } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Types, type Model } from 'mongoose';
import type { Seed } from '../../database/seed.js';
import { Booking } from '../bookings/schemas/booking.schema.js';
import { User } from '../users/schemas/user.schema.js';
import { Feedback } from './schemas/feedback.schema.js';

/**
 * Mỗi phản hồi gắn với một booking đã trả phòng trong seed bookings (BR-FB-01).
 * `legacyBooking` là id giả của bản seed cũ; DB dev đã seed trước đây được chuyển sang booking thật.
 */
export const SAMPLE_FEEDBACK = [
  {
    bookingCode: 'SEED-CHECKED-OUT-001',
    legacyBooking: '6700000000000000000000b1',
    rating: 5,
    content: 'Phòng sạch, nhân viên lễ tân rất nhiệt tình. Sẽ quay lại!',
  },
  {
    bookingCode: 'SEED-CHECKED-OUT-002',
    legacyBooking: '6700000000000000000000b2',
    rating: 3,
    content: 'Phòng ổn nhưng wifi yếu vào buổi tối.',
  },
  {
    bookingCode: 'SEED-CHECKED-OUT-003',
    legacyBooking: '6700000000000000000000b3',
    rating: 2,
    content: 'Check-in phải chờ gần 30 phút, mong khách sạn cải thiện.',
  },
];

/** Phản hồi mẫu của customer@hms.local để thử UC40, UC41. Chạy sau seed bookings. */
export const seedFeedback: Seed = async (app) => {
  const users = app.get<Model<User>>(getModelToken(User.name));
  const bookings = app.get<Model<Booking>>(getModelToken(Booking.name));
  const feedback = app.get<Model<Feedback>>(getModelToken(Feedback.name));
  const customer = await users.findOne({ email: 'customer@hms.local' }).lean();
  if (!customer) return;

  for (const { bookingCode, legacyBooking, ...sample } of SAMPLE_FEEDBACK) {
    const booking = await bookings
      .findOne({ code: bookingCode, customer: customer._id })
      .select('_id')
      .lean();
    if (!booking) {
      Logger.log(
        `Skipping feedback for ${bookingCode}: booking is missing`,
        'Seed',
      );
      continue;
    }
    const filter = { customer: customer._id, booking: booking._id };
    if (!(await feedback.exists(filter))) {
      await feedback.updateOne(
        { customer: customer._id, booking: new Types.ObjectId(legacyBooking) },
        { booking: booking._id },
      );
    }
    await feedback.updateOne(
      filter,
      { $setOnInsert: { ...sample, ...filter } },
      { upsert: true },
    );
  }
};
