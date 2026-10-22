import { VersioningType, type INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import type { Model } from 'mongoose';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { seedRoles } from '../src/modules/roles/seed.js';
import { User } from '../src/modules/users/schemas/user.schema.js';

// UC42, UC43. Cần MongoDB; chưa cấu hình Firebase nên tài khoản chỉ tạo trong HMS.
describe('Accounts (e2e)', () => {
  let app: INestApplication;
  let users: Model<User>;
  let managerId: string;
  const MANAGER = () => ({
    'x-dev-role': 'MANAGER',
    'x-dev-user-id': managerId,
  });
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    await app.init();
    await seedRoles(app);
    users = app.get(getModelToken(User.name));
    await users.deleteMany({ email: /@accounts-e2e\.vn$/ });
    const manager = await users.create({
      email: 'manager@accounts-e2e.vn',
      fullName: 'Quản Lý E2E',
      role: 'MANAGER',
    });
    managerId = String(manager._id);
  });

  afterAll(async () => {
    await users.deleteMany({ email: /@accounts-e2e\.vn$/ });
    await app.close();
  });

  it('chỉ Manager xem được danh sách (BR-RBAC-01)', async () => {
    await http()
      .get('/api/v1/users')
      .set({ 'x-dev-role': 'RECEPTIONIST' })
      .expect(403);
    const res = await http()
      .get('/api/v1/users')
      .query({ search: 'accounts-e2e', limit: 5 })
      .set(MANAGER())
      .expect(200);
    expect(res.body).toMatchObject({ total: 1, page: 1, limit: 5 });
  });

  it('tạo, tìm, sửa và khoá tài khoản nhân viên', async () => {
    const created = await http()
      .post('/api/v1/users')
      .set(MANAGER())
      .send({
        email: 'Le.Tan@accounts-e2e.vn',
        fullName: 'Lễ Tân E2E',
        role: 'RECEPTIONIST',
        password: 'secret12',
      })
      .expect(201);
    expect(created.body).toMatchObject({
      email: 'le.tan@accounts-e2e.vn',
      role: 'RECEPTIONIST',
      isActive: true,
      emailVerified: true,
    });
    const id = created.body.id;

    await http()
      .post('/api/v1/users')
      .set(MANAGER())
      .send({
        email: 'le.tan@accounts-e2e.vn',
        fullName: 'Trùng Email',
        role: 'RECEPTIONIST',
        password: 'secret12',
      })
      .expect(409);
    await http()
      .post('/api/v1/users')
      .set(MANAGER())
      .send({
        email: 'khac@accounts-e2e.vn',
        fullName: 'Sai Role',
        role: 'KHONG_CO',
        password: 'secret12',
      })
      .expect(400);

    const filtered = await http()
      .get('/api/v1/users')
      .query({ search: 'lễ tân', role: 'RECEPTIONIST' })
      .set(MANAGER())
      .expect(200);
    expect(filtered.body.items.map((u: { id: string }) => u.id)).toContain(id);

    const locked = await http()
      .patch(`/api/v1/users/${id}`)
      .set(MANAGER())
      .send({ isActive: false, fullName: 'Lễ Tân Đã Khoá' })
      .expect(200);
    expect(locked.body).toMatchObject({
      isActive: false,
      fullName: 'Lễ Tân Đã Khoá',
    });

    const inactive = await http()
      .get('/api/v1/users')
      .query({ isActive: 'false', search: 'accounts-e2e' })
      .set(MANAGER())
      .expect(200);
    expect(inactive.body.total).toBe(1);
  });

  it('Manager không tự khoá chính mình; id sai thì 404', async () => {
    await http()
      .patch(`/api/v1/users/${managerId}`)
      .set(MANAGER())
      .send({ isActive: false })
      .expect(400);
    await http().get('/api/v1/users/khong-phai-id').set(MANAGER()).expect(404);
  });
});
