import { getModelToken } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import type { Seed } from '../../database/seed.js';
import { BedType } from './schemas/bed-type.schema.js';

export const seedBedTypes: Seed = async (app) => {
  const model = app.get<Model<BedType>>(getModelToken(BedType.name));
  const samples = [
    { name: 'Giường đơn', description: 'Giường cho một người.' },
    { name: 'Giường đôi', description: 'Giường cho hai người.' },
    { name: 'Giường King', description: 'Giường đôi cỡ lớn.' },
    { name: 'Giường tầng', description: 'Giường hai tầng.' },
  ];
  for (const sample of samples) {
    await model.updateOne(
      { name: sample.name },
      { $setOnInsert: { ...sample, isActive: true } },
      { upsert: true },
    );
  }
};
