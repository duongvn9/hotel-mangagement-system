import { VersioningType, type INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { type Model, Types } from 'mongoose';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { RoomType } from '../src/modules/room-types/schemas/room-type.schema.js';
import { Amenity } from '../src/modules/amenities/schemas/amenity.schema.js';
import { seedAmenities } from '../src/modules/amenities/seed.js';
import { seedRoomTypes } from '../src/modules/room-types/seed.js';

describe('UC50 write API', () => {
  let app: INestApplication;
  let types: Model<RoomType>;
  let amenities: Model<Amenity>;
  let active: string;
  let inactive: string;
  let id: string;
  const prefix = 'UC50-E2E-';
  const manager = { 'x-dev-role': 'MANAGER' };
  const http = () => request(app.getHttpServer());
  const payload = () => ({
    name: prefix + 'Standard',
    capacity: 2,
    basePrice: 850000,
    amenities: [active],
  });
  beforeAll(async () => {
    // A dedicated test DB is required; never run cleanup against a development DB.
    if (!/hms_task29_.*test/.test(process.env.MONGODB_URI ?? ''))
      throw new Error('Set dedicated hms_task29_*test MONGODB_URI');
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    await app.init();
    types = app.get(getModelToken(RoomType.name));
    amenities = app.get(getModelToken(Amenity.name));
    await Promise.all([types.init(), amenities.init()]);
    active = String((await amenities.create({ name: prefix + 'Wi-Fi' }))._id);
    inactive = String(
      (await amenities.create({ name: prefix + 'Bath', isActive: false }))._id,
    );
  }, 60000);
  afterAll(async () => {
    if (types) await types.deleteMany({ name: { $regex: '^' + prefix } });
    if (amenities)
      await amenities.deleteMany({ name: { $regex: '^' + prefix } });
    await app?.close();
  });
  it('requires authentication and denies all non-manager system roles on every endpoint', async () => {
    for (const role of [
      undefined,
      'CUSTOMER',
      'RECEPTIONIST',
      'SERVICE_STAFF',
      'OPERATIONS_STAFF',
    ]) {
      const headers = role ? { 'x-dev-role': role } : {};
      const status = role ? 403 : 401;
      await http()
        .post('/api/v1/room-types')
        .set(headers)
        .send(payload())
        .expect(status);
      await http()
        .patch('/api/v1/room-types/' + new Types.ObjectId())
        .set(headers)
        .send({ isActive: false })
        .expect(status);
      await http()
        .get('/api/v1/room-types/' + new Types.ObjectId())
        .set(headers)
        .expect(status);
      await http().get('/api/v1/amenities/options').set(headers).expect(status);
    }
  });
  it('creates, lists, loads, updates partially, deactivates idempotently and reactivates', async () => {
    const created = await http()
      .post('/api/v1/room-types')
      .set(manager)
      .send(payload())
      .expect(201);
    id = created.body.id;
    expect(created.body).toMatchObject({
      availableForBooking: true,
      amenities: [{ id: active, name: prefix + 'Wi-Fi', isActive: true }],
    });
    const list = await http()
      .get('/api/v1/room-types')
      .set(manager)
      .query({ search: prefix })
      .expect(200);
    expect(list.body.items.some((row: { id: string }) => row.id === id)).toBe(
      true,
    );
    await http()
      .patch('/api/v1/room-types/' + id)
      .set(manager)
      .send({ description: 'Changed' })
      .expect(200);
    const detail = await http()
      .get('/api/v1/room-types/' + id)
      .set(manager)
      .expect(200);
    expect(detail.body).toMatchObject({
      description: 'Changed',
      capacity: 2,
      basePrice: 850000,
    });
    for (let attempt = 0; attempt < 2; attempt++) {
      const result = await http()
        .patch('/api/v1/room-types/' + id)
        .set(manager)
        .send({ isActive: false })
        .expect(200);
      expect(result.body).toMatchObject({
        id,
        isActive: false,
        availableForBooking: false,
      });
    }
    const inactiveList = await http()
      .get('/api/v1/room-types')
      .set(manager)
      .query({ search: prefix, isActive: false })
      .expect(200);
    expect(inactiveList.body.items[0]).toMatchObject({
      id,
      isActive: false,
      availableForBooking: false,
    });
    await http()
      .patch('/api/v1/room-types/' + id)
      .set(manager)
      .send({ isActive: true })
      .expect(200);
    expect(await types.findById(id)).not.toBeNull();
  });
  it('rejects duplicate names, invalid IDs, empty patch and immutable fields', async () => {
    await http()
      .post('/api/v1/room-types')
      .set(manager)
      .send(payload())
      .expect(409);
    for (const method of ['get', 'patch'] as const) {
      const bad = http()[method]('/api/v1/room-types/bad').set(manager);
      await (method === 'patch' ? bad.send({ isActive: false }) : bad).expect(
        400,
      );
      const missing = http()
        [method]('/api/v1/room-types/' + new Types.ObjectId())
        .set(manager);
      await (
        method === 'patch' ? missing.send({ isActive: false }) : missing
      ).expect(404);
    }
    for (const data of [
      {},
      { _id: id },
      { updatedAt: 'today' },
      { extra: true },
      { capacity: '2' },
      { isActive: null },
    ])
      await http()
        .patch('/api/v1/room-types/' + id)
        .set(manager)
        .send(data)
        .expect(400);
    await http()
      .delete('/api/v1/room-types/' + id)
      .set(manager)
      .expect(404);
  });
  it('rejects invalid amenities without saving and retains old inactive amenities', async () => {
    for (const ids of [
      [inactive],
      [String(new Types.ObjectId())],
      [active, active],
      ['bad'],
    ]) {
      await http()
        .post('/api/v1/room-types')
        .set(manager)
        .send({ ...payload(), name: prefix + 'Rejected', amenities: ids })
        .expect(400);
      await http()
        .patch('/api/v1/room-types/' + id)
        .set(manager)
        .send({ description: 'Must not save', amenities: ids })
        .expect(400);
    }
    expect(await types.findOne({ name: prefix + 'Rejected' })).toBeNull();
    expect((await types.findById(id))?.description).toBe('Changed');
    await amenities.updateOne({ _id: active }, { $set: { isActive: false } });
    await http()
      .patch('/api/v1/room-types/' + id)
      .set(manager)
      .send({ amenities: [active] })
      .expect(200);
    await http()
      .patch('/api/v1/room-types/' + id)
      .set(manager)
      .send({ amenities: [] })
      .expect(200);
    await http()
      .patch('/api/v1/room-types/' + id)
      .set(manager)
      .send({ amenities: [active] })
      .expect(400);
    const options = await http()
      .get('/api/v1/amenities/options')
      .set(manager)
      .expect(200);
    expect(
      options.body.some((row: { id: string }) =>
        [active, inactive].includes(row.id),
      ),
    ).toBe(false);
  });
  it('retains Manager edits when facility seeds run again', async () => {
    await seedAmenities(app);
    await seedRoomTypes(app);
    const sample = await types.findOne({ name: 'Standard' }).lean();
    const change = {
      description: 'UC50 manager edit',
      capacity: 7,
      basePrice: 1234567,
      amenities: [],
      isActive: false,
    };
    await http()
      .patch('/api/v1/room-types/' + sample!._id)
      .set(manager)
      .send(change)
      .expect(200);
    await seedAmenities(app);
    await seedRoomTypes(app);
    const result = await http()
      .get('/api/v1/room-types/' + sample!._id)
      .set(manager)
      .expect(200);
    expect(result.body).toMatchObject(change);
  });
  it('blocks invalid legacy reactivation but preserves its record on deactivation', async () => {
    const legacy = await types.collection.insertOne({
      name: prefix + 'Legacy',
      description: '',
      capacity: 0,
      basePrice: 0,
      amenities: [],
      isActive: false,
    });
    const path = '/api/v1/room-types/' + legacy.insertedId;
    await http().patch(path).set(manager).send({ isActive: true }).expect(400);
    await http().patch(path).set(manager).send({ isActive: false }).expect(200);
    expect(await types.findById(legacy.insertedId)).not.toBeNull();
  });
  it('documents all write endpoints and DTOs in Swagger', () => {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle('UC50').build(),
    );
    expect(document.paths['/api/v1/room-types'].post).toBeDefined();
    expect(document.paths['/api/v1/room-types/{id}'].get).toBeDefined();
    expect(document.paths['/api/v1/room-types/{id}'].patch).toBeDefined();
    expect(document.paths['/api/v1/amenities/options'].get).toBeDefined();
    expect(document.components?.schemas?.CreateRoomTypeDto).toBeDefined();
  });
});
