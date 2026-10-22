import { getModelToken } from '@nestjs/mongoose';
import { Types, type Model } from 'mongoose';
import type { Seed } from '../../database/seed.js';
import { User } from '../users/schemas/user.schema.js';
import { Feedback } from './schemas/feedback.schema.js';

// TODO(#46): dùng booking thật khi có seed bookings; hiện là id cố định để chạy lại không trùng.
const SAMPLES = [
  {
    booking: '6700000000000000000000b1',
    rating: 5,
    content: 'Phòng sạch, nhân viên lễ tân rất nhiệt tình. Sẽ quay lại!',
  },
  {
    booking: '6700000000000000000000b2',
    rating: 3,
    content: 'Phòng ổn nhưng wifi yếu vào buổi tối.',
  },
  {
    booking: '6700000000000000000000b3',
    rating: 2,
    content: 'Check-in phải chờ gần 30 phút, mong khách sạn cải thiện.',
  },
];

/** Phản hồi mẫu của customer@hms.local để thử UC40, UC41. Chạy sau seed users. */
export const seedFeedback: Seed = async (app) => {
  const users = app.get<Model<User>>(getModelToken(User.name));
  const feedback = app.get<Model<Feedback>>(getModelToken(Feedback.name));
  const customer = await users.findOne({ email: 'customer@hms.local' }).lean();
  if (!customer) return;

  await feedback.bulkWrite(
    SAMPLES.map((sample) => {
      const booking = new Types.ObjectId(sample.booking);
      return {
        updateOne: {
          filter: { customer: customer._id, booking },
          update: {
            $setOnInsert: { ...sample, booking, customer: customer._id },
          },
          upsert: true,
        },
      };
    }),
  );
};
