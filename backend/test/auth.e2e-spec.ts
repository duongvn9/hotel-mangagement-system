import {
  Controller,
  Get,
  VersioningType,
  type INestApplication,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { Role } from '../src/common/constants/role.enum.js';
import { Roles } from '../src/common/decorators/roles.decorator.js';

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

  it('GET /auth/me trả về role của người đang đăng nhập', async () => {
    await get('/auth/me').expect(401);
    const res = await get('/auth/me', { 'x-dev-role': 'RECEPTIONIST' }).expect(
      200,
    );
    expect(res.body).toMatchObject({ role: 'RECEPTIONIST', permissions: [] });
  });

  it('GET /auth/dev-accounts không cần đăng nhập ở dev', () =>
    get('/auth/dev-accounts').expect(200));
});
