import { INestApplication, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';

// Cần MongoDB đang chạy, ví dụ: docker compose up -d mongo
// và MONGODB_URI trỏ tới nó (CI tự dựng service mongo).
describe('Health (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/health', () =>
    request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200)
      .expect((res) => expect(res.body.status).toBe('ok')));

  it('GET /api/v1/health/ready', () =>
    request(app.getHttpServer())
      .get('/api/v1/health/ready')
      .expect(200)
      .expect((res) => expect(res.body.info.mongodb.status).toBe('up')));
});
