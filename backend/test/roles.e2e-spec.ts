import { VersioningType, type INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import type { Model } from 'mongoose';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { Role } from '../src/modules/roles/schemas/role.schema.js';
import { seedRoles } from '../src/modules/roles/seed.js';
import { User } from '../src/modules/users/schemas/user.schema.js';

// UC44-46. Cần MongoDB.
describe('Roles (e2e)', () => {
  let app: INestApplication;
  let roles: Model<Role>;
  let users: Model<User>;
  const MANAGER = { 'x-dev-role': 'MANAGER' };
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
    roles = app.get(getModelToken(Role.name));
    users = app.get(getModelToken(User.name));
    await roles.deleteMany({ code: /^E2E_/ });
    await users.deleteMany({ email: /@roles-e2e\.vn$/ });
  });

  afterAll(async () => {
    await roles.deleteMany({ code: /^E2E_/ });
    await users.deleteMany({ email: /@roles-e2e\.vn$/ });
    await app.close();
  });

  it('chỉ Manager quản lý role (BR-RBAC-02)', async () => {
    await http()
      .get('/api/v1/roles')
      .set({ 'x-dev-role': 'RECEPTIONIST' })
      .expect(403);
    const res = await http().get('/api/v1/roles').set(MANAGER).expect(200);
    const codes = res.body.map((r: { code: string }) => r.code);
    expect(codes).toEqual(
      expect.arrayContaining(['CUSTOMER', 'MANAGER', 'RECEPTIONIST']),
    );
    expect(res.body[0]).toMatchObject({ isSystem: true });
  });

  it('tạo role: mã viết hoa, không trùng mã hoặc tên', async () => {
    const created = await http()
      .post('/api/v1/roles')
      .set(MANAGER)
      .send({ code: 'e2e_housekeeping', name: 'Buồng phòng E2E' })
      .expect(201);
    expect(created.body).toMatchObject({
      code: 'E2E_HOUSEKEEPING',
      isSystem: false,
      permissions: [],
    });

    await http()
      .post('/api/v1/roles')
      .set(MANAGER)
      .send({ code: 'E2E_HOUSEKEEPING', name: 'Tên khác' })
      .expect(409);
    await http()
      .post('/api/v1/roles')
      .set(MANAGER)
      .send({ code: 'E2E_OTHER', name: 'buồng phòng e2e' })
      .expect(409);
    await http()
      .post('/api/v1/roles')
      .set(MANAGER)
      .send({ code: '1-sai', name: 'Mã sai' })
      .expect(400);
  });

  it('sửa role không đổi được mã; gán permission hợp lệ', async () => {
    const role = await roles.findOne({ code: 'E2E_HOUSEKEEPING' }).lean();
    const id = String(role!._id);

    await http()
      .patch(`/api/v1/roles/${id}`)
      .set(MANAGER)
      .send({ code: 'E2E_NEW' })
      .expect(400);
    const renamed = await http()
      .patch(`/api/v1/roles/${id}`)
      .set(MANAGER)
      .send({ name: 'Buồng phòng E2E 2', description: 'Dọn phòng' })
      .expect(200);
    expect(renamed.body).toMatchObject({
      code: 'E2E_HOUSEKEEPING',
      name: 'Buồng phòng E2E 2',
    });

    const assigned = await http()
      .put(`/api/v1/roles/${id}/permissions`)
      .set(MANAGER)
      .send({ permissions: ['task:execute', 'issue:report'] })
      .expect(200);
    expect(assigned.body.permissions).toEqual(['task:execute', 'issue:report']);
    await http()
      .put(`/api/v1/roles/${id}/permissions`)
      .set(MANAGER)
      .send({ permissions: ['task:execute', 'khong:co'] })
      .expect(400);
  });

  it('không tắt role hệ thống hoặc role còn tài khoản dùng (BR-RBAC-05)', async () => {
    const manager = await roles.findOne({ code: 'MANAGER' }).lean();
    await http()
      .patch(`/api/v1/roles/${String(manager!._id)}`)
      .set(MANAGER)
      .send({ isActive: false })
      .expect(400);

    const role = await roles.findOne({ code: 'E2E_HOUSEKEEPING' }).lean();
    const id = String(role!._id);
    const user = await users.create({
      email: 'nv@roles-e2e.vn',
      fullName: 'Nhân Viên E2E',
      role: 'E2E_HOUSEKEEPING',
    });
    await http()
      .patch(`/api/v1/roles/${id}`)
      .set(MANAGER)
      .send({ isActive: false })
      .expect(409);

    await users.updateOne({ _id: user._id }, { isActive: false });
    const off = await http()
      .patch(`/api/v1/roles/${id}`)
      .set(MANAGER)
      .send({ isActive: false })
      .expect(200);
    expect(off.body.isActive).toBe(false);
  });

  it('GET /permissions trả về danh sách để gán', async () => {
    const res = await http()
      .get('/api/v1/permissions')
      .set(MANAGER)
      .expect(200);
    expect(res.body).toContainEqual(
      expect.objectContaining({ code: 'role:manage' }),
    );
  });
});
