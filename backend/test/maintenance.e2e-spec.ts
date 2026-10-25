import { randomUUID } from 'node:crypto';
import { VersioningType, type INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { Model, Types } from 'mongoose';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { Equipment } from '../src/modules/equipment/schemas/equipment.schema.js';
import { Maintenance } from '../src/modules/maintenance/schemas/maintenance.schema.js';
import { Room } from '../src/modules/rooms/schemas/room.schema.js';
import { RoomType } from '../src/modules/room-types/schemas/room-type.schema.js';
import { User } from '../src/modules/users/schemas/user.schema.js';
import { Task } from '../src/modules/tasks/schemas/task.schema.js';
import { TasksService } from '../src/modules/tasks/tasks.service.js';
import { AvailabilityService } from '../src/modules/bookings/availability.service.js';
import {
  seedEquipment,
  EQUIPMENT_SEED_SAMPLES,
} from '../src/modules/equipment/seed.js';
import { assertTestDatabase } from './test-database.js';

describe('UC35 real AppModule, Equipment and MAINTENANCE tasks', () => {
  let app: INestApplication;
  let equipment: Model<Equipment>;
  let reports: Model<Maintenance>;
  let rooms: Model<Room>;
  let types: Model<RoomType>;
  let users: Model<User>;
  let tasks: Model<Task>;
  let actor: Types.ObjectId;
  let type: Types.ObjectId;
  let room: Types.ObjectId;
  let device: Types.ObjectId;
  const original = process.env.MONGODB_URI;
  const createdRooms: Types.ObjectId[] = [];
  const createdReports: Types.ObjectId[] = [];
  const prefix = 'UC35-';
  const ops = () => ({
    'x-dev-role': 'OPERATIONS_STAFF',
    'x-dev-user-id': String(actor),
  });
  const http = () => request(app.getHttpServer());
  const payload = () => ({
    roomId: String(room),
    description: 'Rò điện tại điều hòa',
    requiresAction: true,
    preventsSafeUse: true,
  });
  const post = (body: object, key = randomUUID()) =>
    http()
      .post('/api/v1/maintenance/reports')
      .set(ops())
      .set('Idempotency-Key', key)
      .send(body);
  beforeAll(async () => {
    assertTestDatabase(original);
    const uri = new URL(original!);
    uri.pathname = `/hms_uc35_${randomUUID().replaceAll('-', '')}_test`;
    process.env.MONGODB_URI = uri.toString();
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    SwaggerModule.setup(
      'api/docs',
      app,
      SwaggerModule.createDocument(
        app,
        new DocumentBuilder().setTitle('UC35').build(),
      ),
    );
    await app.init();
    equipment = app.get(getModelToken(Equipment.name));
    reports = app.get(getModelToken(Maintenance.name));
    rooms = app.get(getModelToken(Room.name));
    types = app.get(getModelToken(RoomType.name));
    users = app.get(getModelToken(User.name));
    tasks = app.get(getModelToken(Task.name));
    await Promise.all([
      equipment.init(),
      reports.init(),
      rooms.init(),
      tasks.init(),
    ]);
    actor = (
      await users.create({
        email: 'uc35-ops@example.test',
        fullName: 'UC35 Operations',
        role: 'OPERATIONS_STAFF',
      })
    )._id;
    type = (
      await types.create({
        name: prefix + 'Type',
        adultCapacity: 2,
        childCapacity: 1,
        basePrice: 900000,
      })
    )._id;
  }, 60000);
  beforeEach(async () => {
    room = (
      await rooms.create({
        roomNumber: prefix + randomUUID(),
        floor: 2,
        roomType: type,
      })
    )._id;
    createdRooms.push(room);
    device = (
      await equipment.create({
        assetCode: prefix + randomUUID(),
        name: 'Điều hòa',
        category: 'Điện',
        room,
      })
    )._id;
  });
  afterEach(() => vi.restoreAllMocks());
  afterAll(async () => {
    if (reports) {
      const rows = await reports.find({ reportedBy: actor }).select('_id');
      createdReports.push(...rows.map((r) => r._id));
      await tasks.deleteMany({
        sourceType: 'MAINTENANCE',
        sourceId: { $in: createdReports },
      });
      await reports.deleteMany({ reportedBy: actor });
    }
    if (equipment)
      await equipment.deleteMany({
        assetCode: {
          $in: [
            ...(await equipment
              .find({ assetCode: { $regex: '^UC35-' } })
              .distinct('assetCode')),
            ...EQUIPMENT_SEED_SAMPLES.map((s) => s.assetCode),
          ],
        },
      });
    if (rooms) await rooms.deleteMany({ _id: { $in: createdRooms } });
    if (types) await types.deleteOne({ _id: type });
    if (users) await users.deleteOne({ _id: actor });
    await app?.close();
    if (original === undefined) delete process.env.MONGODB_URI;
    else process.env.MONGODB_URI = original;
  });
  it('requires authentication and excludes every other system role even with issue permissions', async () => {
    await http().get('/api/v1/maintenance/targets').expect(401);
    await http()
      .post('/api/v1/maintenance/reports')
      .send(payload())
      .expect(401);
    for (const role of [
      'CUSTOMER',
      'RECEPTIONIST',
      'SERVICE_STAFF',
      'MANAGER',
    ]) {
      const headers = { 'x-dev-role': role };
      await http().get('/api/v1/maintenance/targets').set(headers).expect(403);
      await http()
        .post('/api/v1/maintenance/reports')
        .set(headers)
        .send(payload())
        .expect(403);
    }
  });
  it('persists real Maintenance→Task references and blocks availability H6 without an Issue', async () => {
    const query = {
      checkIn: '2027-01-01',
      checkOut: '2027-01-02',
      guests: 1,
      roomTypeId: String(type),
    };
    expect(
      (await app.get(AvailabilityService).findAvailableRooms(query)).some(
        (r) => r.id === String(room),
      ),
    ).toBe(true);
    const result = (
      await post({
        ...payload(),
        roomId: undefined,
        equipmentId: String(device),
      }).expect(201)
    ).body;
    expect(result).toMatchObject({ roomMarkedUnavailable: true, warnings: [] });
    const saved = await reports.findById(result.reportId).lean();
    const task = await tasks.findById(result.taskId).lean();
    expect(saved).toMatchObject({
      requiresAction: true,
      preventsSafeUse: true,
    });
    expect(String(saved?.room)).toBe(String(room));
    expect(String(saved?.task)).toBe(result.taskId);
    expect(task).toMatchObject({
      sourceType: 'MAINTENANCE',
      taskType: 'MAINTENANCE',
      priority: 'URGENT',
      status: 'ASSIGNED',
    });
    expect(String(task?.sourceId)).toBe(result.reportId);
    expect(String(task?.assignedTo)).toBe(String(actor));
    expect((await equipment.findById(device).lean())?.condition).toBe('FAULTY');
    expect((await rooms.findById(room).lean())?.status).toBe('MAINTENANCE');
    expect(
      (await app.get(AvailabilityService).findAvailableRooms(query)).some(
        (r) => r.id === String(room),
      ),
    ).toBe(false);
    expect(await reports.db.collection('issues').countDocuments()).toBe(0);
    expect(saved).not.toHaveProperty('status');
    expect(saved).not.toHaveProperty('completedAt');
  });
  it.each(['AVAILABLE', 'CLEANING', 'MAINTENANCE', 'OCCUPIED'])(
    'handles %s atomically without overwriting occupied rooms',
    async (status) => {
      await rooms.updateOne({ _id: room }, { $set: { status } });
      const result = (await post(payload()).expect(201)).body;
      expect(result.roomMarkedUnavailable).toBe(status !== 'OCCUPIED');
      expect((await rooms.findById(room).lean())?.status).toBe(
        status === 'OCCUPIED' ? status : 'MAINTENANCE',
      );
      if (status === 'OCCUPIED')
        expect(result.warnings).toContain(
          'Phòng đang có khách; cần lễ tân xử lý',
        );
    },
  );
  it('accepts common facilities without a Task when no action is required, and preserves UNDER_REPAIR', async () => {
    await equipment.updateOne(
      { _id: device },
      { $set: { condition: 'UNDER_REPAIR' } },
    );
    const first = (
      await post({
        facilityLocation: 'Sảnh chính',
        description: 'Sơn bị tróc',
        requiresAction: false,
      }).expect(201)
    ).body;
    expect(first.taskId).toBeUndefined();
    expect(first.roomMarkedUnavailable).toBe(false);
    const result = (
      await post({
        equipmentId: String(device),
        description: 'Tiếp tục kiểm tra',
        preventsSafeUse: false,
      }).expect(201)
    ).body;
    expect(result.taskId).toBeDefined();
    expect((await equipment.findById(device).lean())?.condition).toBe(
      'UNDER_REPAIR',
    );
    expect((await rooms.findById(room).lean())?.status).toBe('AVAILABLE');
  });
  it('deduplicates concurrent requests, repeats after task completion and never reblocks after manual restoration', async () => {
    const key = randomUUID();
    const responses = await Promise.all([
      post(payload(), key),
      post(payload(), key),
    ]);
    expect(responses.map((r) => r.status)).toEqual([201, 201]);
    expect(responses[0].body).toEqual(responses[1].body);
    const id = responses[0].body.reportId;
    expect(
      await reports.countDocuments({ reportedBy: actor, requestKey: key }),
    ).toBe(1);
    expect(
      await tasks.countDocuments({ sourceId: new Types.ObjectId(id) }),
    ).toBe(1);
    await tasks.updateOne(
      { _id: responses[0].body.taskId },
      {
        $set: {
          status: 'COMPLETED',
          workResult: 'Đã sửa',
          completedAt: new Date(),
        },
      },
    );
    await rooms.updateOne({ _id: room }, { $set: { status: 'AVAILABLE' } });
    expect((await post(payload(), key).expect(201)).body).toEqual(
      responses[0].body,
    );
    expect((await rooms.findById(room).lean())?.status).toBe('AVAILABLE');
    await post({ ...payload(), description: 'Khác' }, key).expect(409);
  });
  it('returns reportId after Task failure and retries without a second report/task', async () => {
    const create = vi
      .spyOn(app.get(TasksService), 'create')
      .mockRejectedValueOnce(new Error('Injected UC35 task failure'));
    const key = randomUUID();
    const partial = await post(payload(), key).expect(503);
    const saved = await reports
      .findOne({ reportedBy: actor, requestKey: key })
      .lean();
    expect(partial.body.message).toContain(String(saved?._id));
    expect((await rooms.findById(room).lean())?.status).toBe('AVAILABLE');
    const result = (await post(payload(), key).expect(201)).body;
    expect(result.reportId).toBe(String(saved?._id));
    expect(create).toHaveBeenCalledTimes(2);
    expect(await tasks.countDocuments({ sourceId: saved?._id })).toBe(1);
    expect(partial.body).toMatchObject({
      statusCode: 503,
      path: '/api/v1/maintenance/reports',
      timestamp: expect.any(String),
      error: expect.any(String),
    });
  });
  it.each([
    {},
    { roomId: 'invalid', description: 'x' },
    { roomId: null, description: 'x' },
    { roomId: String(new Types.ObjectId()), description: 'x' },
    { facilityLocation: 'Sảnh', description: ' ' },
    { facilityLocation: 'Sảnh', description: 'x'.repeat(2001) },
    { facilityLocation: 'Sảnh', description: 'x', preventsSafeUse: true },
    { facilityLocation: 'Sảnh', description: 'x', unknown: true },
    { facilityLocation: 'Sảnh', description: 'x', requiresAction: 'false' },
  ])('rejects invalid body %j without creating reports', async (body) => {
    const count = await reports.countDocuments();
    await post(body).expect(400);
    expect(await reports.countDocuments()).toBe(count);
  });
  it('rejects inactive equipment/rooms and mismatched room-equipment without any write', async () => {
    await equipment.updateOne({ _id: device }, { $set: { isActive: false } });
    await post({ ...payload(), equipmentId: String(device) }).expect(400);
    await equipment.updateOne(
      { _id: device },
      { $set: { isActive: true, room: new Types.ObjectId() } },
    );
    await post({ ...payload(), equipmentId: String(device) }).expect(400);
    await rooms.updateOne({ _id: room }, { $set: { isActive: false } });
    await post(payload()).expect(400);
  });
  it('filters active targets with escaped q, stable limits and no management role exposure', async () => {
    for (let i = 0; i < 23; i++)
      await equipment.create({
        assetCode: `${prefix}SEARCH-${i.toString().padStart(2, '0')}`,
        name: 'Test.*[x]',
        category: 'Test',
        isActive: i !== 0,
      });
    const found = await http()
      .get('/api/v1/maintenance/targets')
      .query({ q: '.*[X]' })
      .set(ops())
      .expect(200);
    expect(found.body.equipment).toHaveLength(20);
    expect(found.body.equipment[0].assetCode).toBe(prefix + 'SEARCH-01');
    const empty = await http()
      .get('/api/v1/maintenance/targets')
      .query({ q: 'absent' })
      .set(ops())
      .expect(200);
    expect(empty.body).toEqual({ rooms: [], equipment: [] });
    await http()
      .get('/api/v1/maintenance/targets')
      .query({ q: 'x'.repeat(101) })
      .set(ops())
      .expect(400);
    await http()
      .get('/api/v1/maintenance/targets')
      .query({ unknown: 'x' })
      .set(ops())
      .expect(400);
  });
  it('seeds equipment idempotently, preserves edited data, skips missing rooms and enforces unique asset codes', async () => {
    await seedEquipment(app);
    expect(await equipment.exists({ assetCode: 'AC-102' })).toBeNull(); // no seeded room 102 in this isolated database
    const seedRoom = await rooms.create({
      roomNumber: '102',
      floor: 1,
      roomType: type,
    });
    createdRooms.push(seedRoom._id);
    await seedEquipment(app);
    expect(
      String((await equipment.findOne({ assetCode: 'AC-102' }).lean())?.room),
    ).toBe(String(seedRoom._id));
    expect(await equipment.exists({ assetCode: 'HEATER-301' })).toBeNull();
    const lift = await equipment.findOne({ assetCode: 'LIFT-01' }).orFail();
    expect(lift.room).toBeUndefined();
    await equipment.updateOne(
      { _id: lift._id },
      { $set: { name: 'Edited', condition: 'UNDER_REPAIR', isActive: false } },
    );
    const before = await equipment.find().sort({ _id: 1 }).lean();
    await seedEquipment(app);
    await seedEquipment(app);
    expect(await equipment.find().sort({ _id: 1 }).lean()).toEqual(before);
    await expect(
      equipment.create({
        assetCode: 'LIFT-01',
        name: 'Duplicate',
        category: 'Test',
      }),
    ).rejects.toMatchObject({ code: 11000 });
  });
  it('documents both endpoints and has no maintenance edit/delete routes', async () => {
    const doc = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle('UC35').build(),
    );
    expect(
      doc.paths['/api/v1/maintenance/reports'].post?.responses,
    ).toHaveProperty('201');
    expect(
      doc.paths['/api/v1/maintenance/targets'].get?.responses,
    ).toHaveProperty('200');
    await http().get('/api/docs/').expect(200);
    const json = await http().get('/api/docs-json').expect(200);
    expect(json.body.paths['/api/v1/maintenance/reports'].post).toBeDefined();
    await http()
      .delete('/api/v1/maintenance/reports/' + new Types.ObjectId())
      .set(ops())
      .expect(404);
  });
});
