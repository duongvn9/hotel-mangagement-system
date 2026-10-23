import { Logger, type INestApplicationContext } from '@nestjs/common';
import { seedFeedback } from '../modules/feedback/seed.js';
import { seedRoles } from '../modules/roles/seed.js';
import { seedUsers } from '../modules/users/seed.js';
import { seedBookings } from '../modules/bookings/seed.js';

/** Seed của một module. Lấy model bằng app.get(getModelToken(X.name)), chạy lại nhiều lần vẫn đúng. */
export type Seed = (app: INestApplicationContext) => Promise<void>;

/** Thêm seed của module mình vào đây, theo thứ tự phụ thuộc dữ liệu. */
export const SEEDS: Record<string, Seed> = {
  roles: seedRoles,
  users: seedUsers,
  bookings: seedBookings,
  feedback: seedFeedback,
};

export async function runSeeds(app: INestApplicationContext) {
  for (const [name, seed] of Object.entries(SEEDS)) {
    await seed(app);
    Logger.log(`Xong seed ${name}`, 'Seed');
  }
}
