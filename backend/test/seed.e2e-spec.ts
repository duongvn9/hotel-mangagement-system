import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import type { Model } from 'mongoose';
import { AppModule } from '../src/app.module.js';
import { runSeeds } from '../src/database/seed.js';
import { Permission } from '../src/modules/roles/schemas/permission.schema.js';
import { Role } from '../src/modules/roles/schemas/role.schema.js';
import { PERMISSIONS, SYSTEM_ROLES } from '../src/modules/roles/seed.js';
import { User } from '../src/modules/users/schemas/user.schema.js';
import { SAMPLE_USERS } from '../src/modules/users/seed.js';

// Cần MongoDB đang chạy (xem health.e2e-spec.ts).
describe('Seed (e2e)', () => {
  let app: INestApplication;
  let roles: Model<Role>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    roles = app.get(getModelToken(Role.name));
    await Promise.all(
      [Role.name, Permission.name, User.name].map((name) =>
        app.get<Model<unknown>>(getModelToken(name)).deleteMany({}),
      ),
    );
  });

  afterAll(async () => {
    await app.close();
  });

  it('chạy 2 lần không tạo trùng và không ghi đè dữ liệu đã sửa', async () => {
    await runSeeds(app);
    await roles.updateOne(
      { code: 'MANAGER' },
      { permissions: ['report:view'] },
    );
    await runSeeds(app);

    const count = (name: string) =>
      app.get<Model<unknown>>(getModelToken(name)).countDocuments();
    expect(await count(Permission.name)).toBe(Object.keys(PERMISSIONS).length);
    expect(await count(Role.name)).toBe(SYSTEM_ROLES.length);
    expect(await count(User.name)).toBe(SAMPLE_USERS.length);

    const manager = await roles.findOne({ code: 'MANAGER' }).lean();
    expect(manager).toMatchObject({
      isSystem: true,
      permissions: ['report:view'],
    });
  });
});
