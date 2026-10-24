import { randomUUID } from 'node:crypto';
import { VersioningType, type INestApplication } from '@nestjs/common';
import { MODULE_METADATA } from '@nestjs/common/constants.js';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { Model, Types } from 'mongoose';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { AmenitiesModule } from '../src/modules/amenities/amenities.module.js';
import { RoomTypesModule } from '../src/modules/room-types/room-types.module.js';
import { Amenity } from '../src/modules/amenities/schemas/amenity.schema.js';
import { RoomType } from '../src/modules/room-types/schemas/room-type.schema.js';
import { seedAmenities } from '../src/modules/amenities/seed.js';
import { seedRoomTypes } from '../src/modules/room-types/seed.js';
import { assertTestDatabase } from './test-database.js';

describe('UC52 amenity writes with real AppModule and standalone Mongo', () => {
  let app: INestApplication;
  let amenities: Model<Amenity>;
  let types: Model<RoomType>;
  let active: string;
  let second: string;
  let inactive: string;
  const originalUri = process.env.MONGODB_URI;
  const prefix = 'UC52-E2E-';
  const manager = { 'x-dev-role': 'MANAGER' };
  const http = () => request(app.getHttpServer());
  const post = (body: object) =>
    http().post('/api/v1/amenities').set(manager).send(body);
  const patch = (id: string, body: object) =>
    http()
      .patch('/api/v1/amenities/' + id)
      .set(manager)
      .send(body);
  const detail = (id: string) =>
    http()
      .get('/api/v1/amenities/' + id)
      .set(manager);
  beforeAll(async () => {
    assertTestDatabase(originalUri);
    const uri = new URL(originalUri!);
    uri.pathname = `/hms_uc52_${randomUUID().replaceAll('-', '')}_test`;
    process.env.MONGODB_URI = uri.toString();
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    await app.init();
    amenities = app.get(getModelToken(Amenity.name));
    types = app.get(getModelToken(RoomType.name));
    await Promise.all([amenities.init(), types.init()]);
    const rows = await types.create(
      ['Active', 'Second', 'Inactive'].map((name, index) => ({
        name: prefix + name,
        adultCapacity: 2,
        childCapacity: 0,
        basePrice: 100,
        isActive: index !== 2,
        amenities: [],
      })),
    );
    [active, second, inactive] = rows.map((row) => String(row._id));
  }, 60000);
  afterAll(async () => {
    if (types) await types.deleteMany({ name: { $regex: '^' + prefix } });
    if (amenities)
      await amenities.deleteMany({ name: { $regex: '^' + prefix } });
    await app?.close();
    if (originalUri === undefined) delete process.env.MONGODB_URI;
    else process.env.MONGODB_URI = originalUri;
  });
  it('boots the real app without reverse module import or forwardRef', () => {
    const imports = Reflect.getMetadata(
      MODULE_METADATA.IMPORTS,
      AmenitiesModule,
    ) as unknown[];
    expect(imports).not.toContain(RoomTypesModule);
    expect(
      imports.some(
        (value) => value && typeof value === 'object' && 'forwardRef' in value,
      ),
    ).toBe(false);
  });
  it('enforces 401 and all four non-manager roles on each write/detail endpoint', async () => {
    for (const role of [
      undefined,
      'CUSTOMER',
      'RECEPTIONIST',
      'SERVICE_STAFF',
      'OPERATIONS_STAFF',
    ]) {
      const headers = role ? { 'x-dev-role': role } : {};
      await http()
        .post('/api/v1/amenities')
        .set(headers)
        .send({ name: prefix + 'Denied' })
        .expect(role ? 403 : 401);
      await http()
        .get('/api/v1/amenities/' + new Types.ObjectId())
        .set(headers)
        .expect(role ? 403 : 401);
      await http()
        .patch('/api/v1/amenities/' + new Types.ObjectId())
        .set(headers)
        .send({ name: 'Denied' })
        .expect(role ? 403 : 401);
    }
  });
  it('creates defaults and assignments, reads both directions and patches a target set without losing other amenities', async () => {
    const empty = await post({
      name: '  ' + prefix + 'Default  ',
      description: ' note ',
    }).expect(201);
    expect(empty.body).toMatchObject({
      name: prefix + 'Default',
      description: 'note',
      isActive: true,
      roomTypes: [],
      roomTypeCount: 0,
    });
    const created = await post({
      name: prefix + 'Attached',
      roomTypeIds: [active, second],
    }).expect(201);
    const id = created.body.id as string;
    expect(
      created.body.roomTypes.map((row: { id: string }) => row.id).sort(),
    ).toEqual([active, second].sort());
    expect((await detail(id).expect(200)).body).toEqual(created.body);
    const list = await http()
      .get('/api/v1/amenities')
      .set(manager)
      .query({ search: prefix + 'Attached' })
      .expect(200);
    expect(list.body.items).toEqual([created.body]);
    await types.updateOne(
      { _id: second },
      { $addToSet: { amenities: empty.body.id } },
    );
    const roomList = await http()
      .get('/api/v1/room-types')
      .set(manager)
      .query({ search: prefix })
      .expect(200);
    expect(
      roomList.body.items.find((row: { id: string }) => row.id === active)
        .amenities,
    ).toContainEqual({ id, name: prefix + 'Attached' });
    const updated = await patch(id, {
      description: 'Changed',
      roomTypeIds: [second],
    }).expect(200);
    expect(updated.body).toMatchObject({
      name: prefix + 'Attached',
      description: 'Changed',
      roomTypeCount: 1,
      roomTypes: [{ id: second }],
    });
    const after = await http()
      .get('/api/v1/room-types')
      .set(manager)
      .query({ search: prefix })
      .expect(200);
    expect(
      after.body.items.find((row: { id: string }) => row.id === active)
        .amenities,
    ).not.toContainEqual(expect.objectContaining({ id }));
    expect(
      after.body.items.find((row: { id: string }) => row.id === second)
        .amenities,
    ).toContainEqual(expect.objectContaining({ id: empty.body.id }));
    const before = (await types.findById(second).lean())!.amenities;
    await patch(id, { name: prefix + 'Renamed' }).expect(200);
    expect((await types.findById(second).lean())!.amenities).toEqual(before);
    await patch(id, { roomTypeIds: [] }).expect(200);
    expect((await detail(id).expect(200)).body.roomTypeCount).toBe(0);
  });
  it('validates every field and target before writes with the standard error envelope', async () => {
    const row = await post({ name: prefix + 'Validation' }).expect(201);
    const bodies = [
      {},
      { name: ' ' },
      { name: 'x'.repeat(101) },
      { name: prefix + 'X', unknown: 1 },
      { name: prefix + 'X', _id: row.body.id },
      { name: prefix + 'X', updatedAt: 'now' },
      { name: prefix + 'X', roomTypeIds: [active, active] },
      { name: prefix + 'X', roomTypeIds: ['bad'] },
      { name: prefix + 'X', roomTypeIds: [inactive] },
      { name: prefix + 'X', roomTypeIds: [String(new Types.ObjectId())] },
      { name: prefix + 'X', roomTypeIds: null },
      { name: prefix + 'X', isActive: false, roomTypeIds: [active] },
    ];
    for (const body of bodies) {
      const before = await amenities.find().sort({ _id: 1 }).lean();
      const refs = await types
        .find()
        .select('-updatedAt')
        .sort({ _id: 1 })
        .lean();
      const error = await post(body).expect(400);
      expect(error.body).toMatchObject({
        statusCode: 400,
        error: 'Bad Request',
        path: '/api/v1/amenities',
        timestamp: expect.any(String),
      });
      expect(await amenities.find().sort({ _id: 1 }).lean()).toEqual(before);
      expect(
        await types.find().select('-updatedAt').sort({ _id: 1 }).lean(),
      ).toEqual(refs);
    }
    for (const body of [
      {},
      { createdAt: 'now' },
      { _id: row.body.id },
      { name: null },
      { roomTypeIds: null },
      { name: 'Updated', roomTypeIds: [inactive] },
    ]) {
      const before = await amenities.findById(row.body.id).lean();
      await patch(row.body.id, body).expect(400);
      expect(await amenities.findById(row.body.id).lean()).toEqual(before);
    }
    await post({ name: prefix + 'Validation' }).expect(409);
    const other = await post({ name: prefix + 'Other' }).expect(201);
    await patch(other.body.id, {
      name: prefix + 'Validation',
      roomTypeIds: [active],
    }).expect(409);
    await post({ name: prefix + 'validation' }).expect(201); // Existing unique index is case sensitive.
  });
  it('retains inactive links, blocks inactive new links, permits removals/reactivation and never exposes DELETE', async () => {
    const row = await post({
      name: prefix + 'Status',
      roomTypeIds: [active],
    }).expect(201);
    const id = row.body.id as string;
    await types.updateOne({ _id: inactive }, { $addToSet: { amenities: id } });
    await patch(id, { roomTypeIds: [active, inactive] }).expect(200);
    await patch(id, { isActive: false }).expect(200);
    await patch(id, { isActive: false }).expect(200);
    expect((await detail(id)).body).toMatchObject({
      isActive: false,
      roomTypeCount: 2,
    });
    await patch(id, {
      name: prefix + 'NotSaved',
      roomTypeIds: [active, second, inactive],
    }).expect(400);
    expect((await detail(id)).body.name).toBe(prefix + 'Status');
    await patch(id, {
      description: 'Inactive edit',
      roomTypeIds: [active],
    }).expect(200);
    await patch(id, { isActive: true, roomTypeIds: [active, second] }).expect(
      200,
    );
    await http()
      .delete('/api/v1/amenities/' + id)
      .set(manager)
      .expect(404);
    await detail('bad').expect(400);
    await patch('bad', { name: 'X' }).expect(400);
    await detail(String(new Types.ObjectId())).expect(404);
    await patch(String(new Types.ObjectId()), { name: 'X' }).expect(404);
    const options = await http()
      .get('/api/v1/amenities/options')
      .set(manager)
      .expect(200);
    expect(options.body).toContainEqual({ id, name: prefix + 'Status' });
  });
  it('compensates real partial insert assignments and replays a partial PATCH safely', async () => {
    const original = types.bulkWrite.bind(types);
    const spy = vi.spyOn(types, 'bulkWrite');
    spy.mockImplementationOnce(async (operations) => {
      await original(operations.slice(0, 1));
      throw new Error('Injected partial create');
    });
    try {
      await post({
        name: prefix + 'Compensated',
        roomTypeIds: [active, second],
      }).expect(503);
      expect(
        await amenities.exists({ name: prefix + 'Compensated' }),
      ).toBeNull();
      const refs = await types.find({ _id: { $in: [active, second] } }).lean();
      for (const type of refs)
        for (const ref of type.amenities)
          expect(await amenities.exists({ _id: ref })).not.toBeNull();
      const row = await post({
        name: prefix + 'Replay',
        roomTypeIds: [active],
      }).expect(201);
      const id = row.body.id as string;
      spy.mockImplementationOnce(async (operations) => {
        await original(operations.slice(0, 1));
        throw new Error('Injected partial update');
      });
      const body = { description: 'Saved first', roomTypeIds: [second] };
      const failed = await patch(id, body).expect(503);
      expect(failed.body.message).toContain('gửi lại');
      expect((await detail(id)).body.description).toBe('Saved first');
      await patch(id, body).expect(200);
      await patch(id, body).expect(200);
      expect((await detail(id)).body).toMatchObject({
        roomTypeCount: 1,
        roomTypes: [{ id: second }],
      });
      expect(
        (await types.findById(second).lean())!.amenities.filter(
          (value) => String(value) === id,
        ),
      ).toHaveLength(1);
    } finally {
      spy.mockRestore();
    }
  });
  it('seed twice preserves Manager changes to both metadata and assignments', async () => {
    await seedAmenities(app);
    await seedRoomTypes(app);
    const wifi = await amenities.findOne({ name: 'Wi-Fi' }).orFail();
    await patch(String(wifi._id), {
      description: 'Manager UC52',
      roomTypeIds: [active],
    }).expect(200);
    await patch(String(wifi._id), { isActive: false }).expect(200);
    const before = await amenities.find().sort({ _id: 1 }).lean();
    const refs = await types
      .find()
      .select('-updatedAt')
      .sort({ _id: 1 })
      .lean();
    await seedAmenities(app);
    await seedRoomTypes(app);
    await seedAmenities(app);
    await seedRoomTypes(app);
    expect(await amenities.find().sort({ _id: 1 }).lean()).toEqual(before);
    expect(
      await types.find().select('-updatedAt').sort({ _id: 1 }).lean(),
    ).toEqual(refs);
  });
  it('documents all new routes, DTOs, responses and error statuses', () => {
    const doc = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle('UC52').build(),
    );
    expect(doc.paths['/api/v1/amenities'].post?.responses).toHaveProperty(
      '201',
    );
    for (const method of ['get', 'patch'] as const)
      expect(
        doc.paths['/api/v1/amenities/{id}'][method]?.responses,
      ).toHaveProperty('200');
    for (const code of ['400', '401', '403', '404', '409', '503'])
      expect(
        doc.paths['/api/v1/amenities/{id}'].patch?.responses,
      ).toHaveProperty(code);
    expect(doc.paths['/api/v1/room-types/options'].get).toBeDefined();
    expect(doc.components?.schemas?.UpdateAmenityDto).toHaveProperty(
      'properties.roomTypeIds',
    );
  });
});
