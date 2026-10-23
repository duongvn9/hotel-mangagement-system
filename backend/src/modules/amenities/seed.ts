import { getModelToken } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import type { Seed } from '../../database/seed.js';
import { Amenity } from './schemas/amenity.schema.js';

export const seedAmenities: Seed = async (app) => {
  const model = app.get<Model<Amenity>>(getModelToken(Amenity.name));
  for (const name of ['Wi-Fi', 'Điều hòa', 'Bồn tắm']) {
    await model.updateOne(
      { name },
      { $setOnInsert: { name, description: '', isActive: true } },
      { upsert: true },
    );
  }
};
