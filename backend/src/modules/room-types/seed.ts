import { getModelToken } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import type { Seed } from '../../database/seed.js';
import { Amenity } from '../amenities/schemas/amenity.schema.js';
import { RoomType } from './schemas/room-type.schema.js';

export const seedRoomTypes: Seed = async (app) => {
  const model = app.get<Model<RoomType>>(getModelToken(RoomType.name));
  const amenities = await app
    .get<Model<Amenity>>(getModelToken(Amenity.name))
    .find({ name: { $in: ['Wi-Fi', 'Điều hòa', 'Bồn tắm'] } })
    .sort({ name: 1 });
  const samples = [
    {
      name: 'Standard',
      description: 'Phòng tiêu chuẩn cho hai khách.',
      capacity: 2,
      basePrice: 850000,
      isActive: true,
      amenities: amenities
        .filter((a) => a.name !== 'Bồn tắm')
        .map((a) => a._id),
    },
    {
      name: 'Deluxe',
      description: 'Phòng rộng rãi với đầy đủ tiện nghi.',
      capacity: 3,
      basePrice: 1500000,
      isActive: true,
      amenities: amenities.map((a) => a._id),
    },
    {
      name: 'Suite',
      description: 'Không gian nghỉ dưỡng cho gia đình, tạm ngừng đặt.',
      capacity: 4,
      basePrice: 2800000,
      isActive: false,
      amenities: amenities.map((a) => a._id),
    },
  ];
  for (const sample of samples) {
    await model.updateOne(
      { name: sample.name },
      { $setOnInsert: sample },
      { upsert: true },
    );
  }
};
