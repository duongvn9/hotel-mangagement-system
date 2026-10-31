import { SEED_ASSETS } from '../../database/seed-assets.js';
import { getModelToken } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import type { Seed } from '../../database/seed.js';
import { Amenity } from '../amenities/schemas/amenity.schema.js';
import { RoomType } from './schemas/room-type.schema.js';
import { migrateRoomTypeCapacities } from './migrate-capacities.js';

export const seedRoomTypes: Seed = async (app) => {
  const model = app.get<Model<RoomType>>(getModelToken(RoomType.name));
  await migrateRoomTypeCapacities(model);
  const amenities = await app
    .get<Model<Amenity>>(getModelToken(Amenity.name))
    .find({ name: { $in: ['Wi-Fi', 'Điều hòa', 'Bồn tắm'] } })
    .sort({ name: 1 });
  const samples = [
    {
      name: 'Standard',
      description: 'Phòng tiêu chuẩn cho hai khách.',
      adultCapacity: 2,
      childCapacity: 1,
      basePrice: 850000,
      isActive: true,
      amenities: amenities
        .filter((a) => a.name !== 'Bồn tắm')
        .map((a) => a._id),
    },
    {
      name: 'Deluxe',
      description: 'Phòng rộng rãi với đầy đủ tiện nghi.',
      adultCapacity: 2,
      childCapacity: 0,
      basePrice: 1500000,
      isActive: true,
      amenities: amenities.map((a) => a._id),
    },
    {
      name: 'Suite',
      description: 'Không gian nghỉ dưỡng cho gia đình, tạm ngừng đặt.',
      adultCapacity: 4,
      childCapacity: 2,
      basePrice: 2800000,
      isActive: false,
      amenities: amenities.map((a) => a._id),
    },
  ];
  for (const sample of samples) {
    await model.updateOne(
      { name: sample.name },
      {
        $setOnInsert: {
          ...sample,
          images:
            SEED_ASSETS['room-types'][
              sample.name as keyof (typeof SEED_ASSETS)['room-types']
            ],
        },
      },
      { upsert: true },
    );
  }
};
