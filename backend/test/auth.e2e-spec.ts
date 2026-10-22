import {
  Controller,
  Get,
  VersioningType,
  type INestApplication,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { Role } from '../src/common/constants/role.enum.js';
import { Permissions } from '../src/common/decorators/permissions.decorator.js';
import { Roles } from '../src/common/decorators/roles.decorator.js';
import { seedRoles } from '../src/modules/roles/seed.js';
import { User } from '../src/modules/users/schemas/user.schema.js';

@Controller('probe')
class ProbeController {
  @Get('any')
  any() {
    return { ok: true };
  }

  @Roles(Role.Manager)
  @Get('manager')
  manager() {
    return { ok: true };
  }

  @Roles(Role.Manager)
  @Permissions('task:execute')
  @Get('task')
  task() {
    return { ok: true };
  }
}

// Guard toàn cục (AuthGuard + RolesGuard) và DevAuthMiddleware chạy cùng nhau. Cần MongoDB.
describe('Auth (e2e)', () => {
  let app: INestApplication;
  const get = (path: string, headers: Record<string, string> = {}) =>
    request(app.getHttpServer()).get(`/api/v1${path}`).set(headers);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [ProbeController],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    await app.init();
    await seedRoles(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('endpoint @Public() không cần đăng nhập', () =>
    get('/health').expect(200));

  it('chưa đăng nhập hoặc token sai: 401', async () => {
    await get('/probe/any').expect(401);
    await get('/probe/any', { authorization: 'Bearer sai' }).expect(401);
  });

  it('header dev qua được AuthGuard, RolesGuard kiểm tra role', async () => {
    await get('/probe/any', { 'x-dev-role': 'CUSTOMER' }).expect(200);
    await get('/probe/manager', { 'x-dev-role': 'CUSTOMER' }).expect(403);
    await get('/probe/manager', { 'x-dev-role': 'MANAGER' }).expect(200);
  });

  it('@Permissions(): role có đủ permission (theo seed) dùng được (UC45)', async () => {
    await get('/probe/task', { 'x-dev-role': 'MANAGER' }).expect(200);
    await get('/probe/task', { 'x-dev-role': 'SERVICE_STAFF' }).expect(200);
    await get('/probe/task', { 'x-dev-role': 'CUSTOMER' }).expect(403);
  });

  it('GET /auth/me trả về role của người đang đăng nhập', async () => {
    await get('/auth/me').expect(401);
    const res = await get('/auth/me', { 'x-dev-role': 'RECEPTIONIST' }).expect(
      200,
    );
    expect(res.body.role).toBe('RECEPTIONIST');
    expect(Array.isArray(res.body.permissions)).toBe(true);
  });

  it('GET /auth/dev-accounts không cần đăng nhập ở dev', () =>
    get('/auth/dev-accounts').expect(200));

  it('header dev sai: 400 theo format lỗi chung', async () => {
    const res = await get('/probe/any', { 'x-dev-role': 'ADMIN' }).expect(400);
    expect(res.body.path).toBe('/api/v1/probe/any');
  });

  it('PATCH /users/me chỉ sửa được họ tên, số điện thoại (BR-ACC-06)', async () => {
    const users = app.get<Model<User>>(getModelToken(User.name));
    await users.deleteMany({ email: 'profile-e2e@hms.local' });
    const user = await users.create({
      email: 'profile-e2e@hms.local',
      fullName: 'Trước Khi Sửa',
      role: 'CUSTOMER',
    });
    const headers = { 'x-dev-user-id': String(user._id) };
    const patch = (body: object) =>
      request(app.getHttpServer())
        .patch('/api/v1/users/me')
        .set(headers)
        .send(body);

    const ok = await patch({ fullName: 'Sau Khi Sửa', phone: '0912345678' });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({
      fullName: 'Sau Khi Sửa',
      role: 'CUSTOMER',
    });
    await patch({ role: 'MANAGER' }).expect(400);
    await patch({ isActive: false }).expect(400);
    await patch({ phone: '123' }).expect(400);
    const cleared = await patch({ phone: '' }).expect(200);
    expect(cleared.body.phone).toBeUndefined();
    expect(await users.findById(user._id).lean()).toMatchObject({
      role: 'CUSTOMER',
      isActive: true,
    });
  });

  it('POST /auth/register không có token: 401', () =>
    request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ fullName: 'Khách Mới' })
      .expect(401));
});
