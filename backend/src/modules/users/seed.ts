import { Logger } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { Role } from '../../common/constants/role.enum.js';
import type { Seed } from '../../database/seed.js';
import { User } from './schemas/user.schema.js';

/**
 * Mỗi role một tài khoản mẫu. Chưa có firebaseUid: #15 nối với tài khoản Firebase
 * theo email ở lần đăng nhập đầu tiên.
 */
export const SAMPLE_USERS: Pick<
  User,
  'email' | 'fullName' | 'phone' | 'role'
>[] = [
  {
    email: 'customer@hms.local',
    fullName: 'Nguyễn Văn Khách',
    phone: '0900000001',
    role: Role.Customer,
  },
  {
    email: 'receptionist@hms.local',
    fullName: 'Trần Thị Lễ Tân',
    phone: '0900000002',
    role: Role.Receptionist,
  },
  {
    email: 'service@hms.local',
    fullName: 'Lê Văn Dịch Vụ',
    phone: '0900000003',
    role: Role.ServiceStaff,
  },
  {
    email: 'operations@hms.local',
    fullName: 'Phạm Văn Vận Hành',
    phone: '0900000004',
    role: Role.OperationsStaff,
  },
  {
    email: 'manager@hms.local',
    fullName: 'Hoàng Thị Quản Lý',
    phone: '0900000005',
    role: Role.Manager,
  },
];

export const seedUsers: Seed = async (app) => {
  const users = app.get<Model<User>>(getModelToken(User.name));

  await users.bulkWrite(
    SAMPLE_USERS.map((user) => ({
      updateOne: {
        filter: { email: user.email },
        update: { $setOnInsert: { ...user, emailVerified: true } },
        upsert: true,
      },
    })),
  );

  // In _id để dùng cho header x-dev-user-id khi test API.
  const saved = await users
    .find({ email: { $in: SAMPLE_USERS.map((u) => u.email) } })
    .lean();
  for (const u of saved) {
    Logger.log(
      `${u.role.padEnd(16)} ${u.email.padEnd(24)} ${String(u._id)}`,
      'Seed',
    );
  }
};
