import { VersioningType, type INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { Types, type Model } from 'mongoose';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { Feedback } from '../src/modules/feedback/schemas/feedback.schema.js';
import { User } from '../src/modules/users/schemas/user.schema.js';

// UC40, UC41. Cần MongoDB.
describe('Feedback (e2e)', () => {
  let app: INestApplication;
  let users: Model<User>;
  let feedback: Model<Feedback>;
  let receptionistId: string;
  let unrepliedId: string;
  const http = () => request(app.getHttpServer());
  const RECEPTIONIST = () => ({
    'x-dev-role': 'RECEPTIONIST',
    'x-dev-user-id': receptionistId,
  });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    await app.init();
    users = app.get(getModelToken(User.name));
    feedback = app.get(getModelToken(Feedback.name));

    await users.deleteMany({ email: /@feedback-e2e\.vn$/ });
    const [customer, receptionist] = await users.create([
      {
        email: 'khach@feedback-e2e.vn',
        fullName: 'Khách Phản Hồi',
        role: 'CUSTOMER',
      },
      {
        email: 'letan@feedback-e2e.vn',
        fullName: 'Lễ Tân Trả Lời',
        role: 'RECEPTIONIST',
      },
    ]);
    receptionistId = String(receptionist._id);
    await feedback.deleteMany({ customer: customer._id });
    const [unreplied] = await feedback.create([
      {
        customer: customer._id,
        booking: new Types.ObjectId(),
        rating: 2,
        content: 'Wifi yếu quá',
      },
      {
        customer: customer._id,
        booking: new Types.ObjectId(),
        rating: 5,
        content: 'Tuyệt vời',
        reply: {
          content: 'Cảm ơn anh/chị',
          repliedBy: receptionist._id,
          repliedAt: new Date(),
        },
      },
    ]);
    unrepliedId = String(unreplied._id);
  });

  afterAll(async () => {
    const ids = await users
      .find({ email: /@feedback-e2e\.vn$/ })
      .distinct('_id');
    await feedback.deleteMany({ customer: { $in: ids } });
    await users.deleteMany({ _id: { $in: ids } });
    await app.close();
  });

  it('Lễ tân, Manager xem được; Customer bị 403 (BR-FB-04)', async () => {
    await http()
      .get('/api/v1/feedback')
      .set({ 'x-dev-role': 'CUSTOMER' })
      .expect(403);
    await http()
      .get('/api/v1/feedback')
      .set({ 'x-dev-role': 'MANAGER' })
      .expect(200);
  });

  it('tìm theo tên khách, lọc chưa trả lời và theo số sao', async () => {
    const res = await http()
      .get('/api/v1/feedback')
      .query({ search: 'khách phản hồi', replied: 'false' })
      .set(RECEPTIONIST())
      .expect(200);
    expect(res.body.total).toBe(1);
    expect(res.body.items[0]).toMatchObject({
      id: unrepliedId,
      rating: 2,
      customer: { fullName: 'Khách Phản Hồi' },
    });

    const fiveStars = await http()
      .get('/api/v1/feedback')
      .query({ search: 'feedback-e2e', rating: 5 })
      .set(RECEPTIONIST())
      .expect(200);
    expect(fiveStars.body.items[0].reply.repliedBy.fullName).toBe(
      'Lễ Tân Trả Lời',
    );
  });

  it('chỉ Lễ tân trả lời được, một lần, lưu người và thời điểm (BR-FB-05/06)', async () => {
    await http()
      .post(`/api/v1/feedback/${unrepliedId}/reply`)
      .set({ 'x-dev-role': 'MANAGER' })
      .send({ content: 'Xin lỗi' })
      .expect(403);
    await http()
      .post(`/api/v1/feedback/${unrepliedId}/reply`)
      .set(RECEPTIONIST())
      .send({ content: '   ' })
      .expect(400);

    const res = await http()
      .post(`/api/v1/feedback/${unrepliedId}/reply`)
      .set(RECEPTIONIST())
      .send({ content: 'Khách sạn đã nâng cấp wifi, cảm ơn góp ý' })
      .expect(201);
    expect(res.body.reply).toMatchObject({
      content: 'Khách sạn đã nâng cấp wifi, cảm ơn góp ý',
      repliedBy: { id: receptionistId, fullName: 'Lễ Tân Trả Lời' },
    });
    expect(res.body.reply.repliedAt).toBeTruthy();

    await http()
      .post(`/api/v1/feedback/${unrepliedId}/reply`)
      .set(RECEPTIONIST())
      .send({ content: 'Trả lời lần hai' })
      .expect(409);
    await http()
      .post(`/api/v1/feedback/${String(new Types.ObjectId())}/reply`)
      .set(RECEPTIONIST())
      .send({ content: 'Không tồn tại' })
      .expect(404);
  });
});
