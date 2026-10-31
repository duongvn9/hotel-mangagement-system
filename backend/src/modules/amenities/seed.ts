import { SEED_ASSETS } from '../../database/seed-assets.js';
import { getModelToken } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import type { Seed } from '../../database/seed.js';
import { Amenity } from './schemas/amenity.schema.js';

export const seedAmenities: Seed = async (app) => {
  const model = app.get<Model<Amenity>>(getModelToken(Amenity.name));
  const samples = [
    ...['Wi-Fi', 'Điều hòa', 'Bồn tắm'].map((name) => ({
      name,
      description: '',
      isActive: true,
    })),
    {
      name: 'Máy sấy tóc',
      description: 'Tiện nghi chưa gắn loại phòng.',
      isActive: true,
    },
    {
      name: 'Điện thoại bàn',
      description: 'Tiện nghi đã ngừng cung cấp.',
      isActive: false,
    },
  ];
  for (const sample of samples) {
    const now = new Date();
    await model.updateOne(
      { name: sample.name },
      {
        $setOnInsert: {
          ...sample,
          iconUrl:
            SEED_ASSETS['amenities'][
              sample.name as keyof (typeof SEED_ASSETS)['amenities']
            ],
          createdAt: now,
          updatedAt: now,
        },
      },
      { upsert: true, timestamps: false },
    );
  }
};
