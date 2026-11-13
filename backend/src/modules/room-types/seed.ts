import { SEED_ASSETS } from '../../database/seed-assets.js';
import { getModelToken } from '@nestjs/mongoose';
import type { Model, Types } from 'mongoose';
import type { Seed } from '../../database/seed.js';
import { Amenity } from '../amenities/schemas/amenity.schema.js';
import { BedType } from '../bed-types/schemas/bed-type.schema.js';
import { RoomType } from './schemas/room-type.schema.js';
import { migrateRoomTypeCapacities } from './migrate-capacities.js';

export const seedRoomTypes: Seed = async (app) => {
  const model = app.get<Model<RoomType>>(getModelToken(RoomType.name));
  await migrateRoomTypeCapacities(model);
  const amenities = await app
    .get<Model<Amenity>>(getModelToken(Amenity.name))
    .find({ name: { $in: ['Wi-Fi', 'Điều hòa', 'Bồn tắm'] } })
    .sort({ name: 1 });
  const bedTypes = await app
    .get<Model<BedType>>(getModelToken(BedType.name))
    .find({})
    .lean();
  const bedId = (name: string): Types.ObjectId | undefined =>
    bedTypes.find((bed) => bed.name === name)?._id;
  const beds = (config: { name: string; quantity: number }[]) =>
    config.flatMap(({ name, quantity }) => {
      const bedType = bedId(name);
      return bedType ? [{ bedType, quantity }] : [];
    });
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
      beds: beds([{ name: 'Giường đôi', quantity: 1 }]),
    },
    {
      name: 'Deluxe',
      description: 'Phòng rộng rãi với đầy đủ tiện nghi.',
      adultCapacity: 2,
      childCapacity: 0,
      basePrice: 1500000,
      isActive: true,
      amenities: amenities.map((a) => a._id),
      beds: beds([{ name: 'Giường King', quantity: 1 }]),
    },
    {
      name: 'Suite',
      description: 'Không gian nghỉ dưỡng cho gia đình, tạm ngừng đặt.',
      adultCapacity: 4,
      childCapacity: 2,
      basePrice: 2800000,
      isActive: false,
      amenities: amenities.map((a) => a._id),
      beds: beds([
        { name: 'Giường đôi', quantity: 1 },
        { name: 'Giường đơn', quantity: 2 },
      ]),
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
    // Backfill beds for room types seeded before bed configuration existed.
    if (sample.beds.length)
      await model.updateOne(
        {
          name: sample.name,
          $or: [{ beds: { $exists: false } }, { beds: { $size: 0 } }],
        },
        { $set: { beds: sample.beds } },
      );
  }
};
