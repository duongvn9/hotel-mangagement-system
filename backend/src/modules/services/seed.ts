import { SEED_ASSETS } from '../../database/seed-assets.js';
import { getModelToken } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import type { Seed } from '../../database/seed.js';
import { Service } from './schemas/service.schema.js';

export const SERVICE_SEED_SAMPLES = [
  {
    name: 'Giặt ủi',
    description: 'Giặt và ủi quần áo theo yêu cầu.',
    unit: 'lần',
    billable: true,
    price: 50000,
    isActive: true,
  },
  {
    name: 'Ăn sáng tại phòng',
    description: 'Phục vụ bữa sáng tại phòng.',
    unit: 'suất',
    billable: true,
    price: 150000,
    isActive: true,
  },
  {
    name: 'Đưa đón sân bay',
    description: 'Xe đưa đón theo lịch hẹn.',
    unit: 'chuyến',
    billable: true,
    price: 450000,
    isActive: true,
  },
  {
    name: 'Đón tiếp khách',
    description: 'Hỗ trợ đón tiếp khách lưu trú.',
    unit: '',
    billable: true,
    price: 0,
    isActive: true,
  },
  {
    name: 'Thông tin du lịch',
    description: 'Thông tin tham quan và hướng dẫn địa phương.',
    unit: '',
    billable: false,
    price: null,
    isActive: true,
  },
  {
    name: 'Chăm sóc spa',
    description: 'Dịch vụ đang tạm ngừng, chưa thiết lập giá.',
    unit: 'lượt',
    billable: true,
    price: null,
    isActive: false,
  },
];
export const seedServices: Seed = async (app) => {
  const model = app.get<Model<Service>>(getModelToken(Service.name));
  await model.init();
  for (const sample of SERVICE_SEED_SAMPLES) {
    const now = new Date();
    await model.updateOne(
      { name: sample.name },
      {
        $setOnInsert: {
          ...sample,
          imageUrl:
            SEED_ASSETS['services'][
              sample.name as keyof (typeof SEED_ASSETS)['services']
            ],
          createdAt: now,
          updatedAt: now,
        },
      },
      { upsert: true, timestamps: false },
    );
  }
};
