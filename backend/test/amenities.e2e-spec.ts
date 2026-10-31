import { randomUUID } from 'node:crypto';
import { VersioningType, type INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { Model, Types } from 'mongoose';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { Amenity } from '../src/modules/amenities/schemas/amenity.schema.js';
import { RoomType } from '../src/modules/room-types/schemas/room-type.schema.js';
import { seedAmenities } from '../src/modules/amenities/seed.js';
import { seedRoomTypes } from '../src/modules/room-types/seed.js';
import { assertTestDatabase } from './test-database.js';
describe('UC51 amenity list API', () => {
  let app: INestApplication;
  let amenities: Model<Amenity>;
  let types: Model<RoomType>;
  const originalUri = process.env.MONGODB_URI;
  const prefix = 'UC51-E2E-';
  const manager = { 'x-dev-role': 'MANAGER' };
  const http = () => request(app.getHttpServer());
  const get = () => http().get('/api/v1/amenities').set(manager);
  let attached: Types.ObjectId;
  let inactive: Types.ObjectId;
  beforeAll(async () => {
    assertTestDatabase(originalUri);
    const uri = new URL(originalUri!);
    uri.pathname = `/hms_uc51_${randomUUID().replaceAll('-', '')}_test`;
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
    attached = (
      await amenities.create({
        name: prefix + 'A.*[x]',
        description: 'Full description',
      })
    )._id;
    inactive = (await amenities.create({ name: prefix + 'B', isActive: false }))
      ._id;
    await amenities.create({ name: prefix + 'C' });
    await types.create([
      {
        name: prefix + 'Alpha',
        adultCapacity: 2,
        childCapacity: 0,
        basePrice: 1,
        amenities: [attached, inactive, new Types.ObjectId()],
      },
      {
        name: prefix + 'Beta',
        adultCapacity: 2,
        childCapacity: 0,
        basePrice: 1,
        isActive: false,
        amenities: [attached],
      },
    ]);
  }, 60000);
  afterAll(async () => {
    if (types) await types.deleteMany({ name: { $regex: '^' + prefix } });
    if (amenities)
      await amenities.deleteMany({ name: { $regex: '^' + prefix } });
    await app?.close();
    if (originalUri === undefined) delete process.env.MONGODB_URI;
    else process.env.MONGODB_URI = originalUri;
  });
  it('requires authentication and rejects all four other system roles', async () => {
    await http().get('/api/v1/amenities').expect(401);
    for (const role of [
      'CUSTOMER',
      'RECEPTIONIST',
      'SERVICE_STAFF',
      'OPERATIONS_STAFF',
    ])
      await http()
        .get('/api/v1/amenities')
        .set({ 'x-dev-role': role })
        .expect(403);
  });
  it('returns inactive amenities/types, reverse refs sorted and unattached amenities without orphan failure', async () => {
    const result = await get().query({ search: prefix }).expect(200);
    expect(result.body).toMatchObject({ total: 3, page: 1, limit: 10 });
    expect(result.body.items[0]).toMatchObject({
      id: String(attached),
      description: 'Full description',
      roomTypeCount: 2,
      roomTypes: [
        { name: prefix + 'Alpha', isActive: true },
        { name: prefix + 'Beta', isActive: false },
      ],
    });
    expect(result.body.items[1]).toMatchObject({
      isActive: false,
      roomTypeCount: 1,
    });
    expect(result.body.items[2]).toMatchObject({
      roomTypes: [],
      roomTypeCount: 0,
    });
    expect(Object.keys(result.body.items[0]).sort()).toEqual([
      'description',
      'id',
      'images',
      'isActive',
      'name',
      'roomTypeCount',
      'roomTypes',
    ]);
  });
  it('supports literal case insensitive search, false, pagination and both sorts', async () => {
    expect(
      (
        await get()
          .query({ search: prefix.toLowerCase() + 'a.*[X]' })
          .expect(200)
      ).body.total,
    ).toBe(1);
    expect(
      (await get().query({ search: prefix, isActive: false }).expect(200)).body
        .items[0].id,
    ).toBe(String(inactive));
    const first = await get().query({ search: prefix, limit: 1 }).expect(200);
    const second = await get()
      .query({ search: prefix, limit: 1, page: 2 })
      .expect(200);
    expect(first.body.total).toBe(3);
    expect(second.body.items[0].id).toBe(String(inactive));
    expect(
      (
        await get()
          .query({ search: prefix, sortBy: 'name', sortOrder: 'desc' })
          .expect(200)
      ).body.items[0].name,
    ).toBe(prefix + 'C');
    const created = await get()
      .query({ search: prefix, sortBy: 'createdAt', sortOrder: 'asc' })
      .expect(200);
    expect(created.body.items).toHaveLength(3);
  });
  it.each([
    { page: 0 },
    { limit: 1000 },
    { sortBy: 'price' },
    { sortOrder: 'up' },
    { unknown: 'x' },
    { isActive: 'yes' },
  ])('rejects invalid query %j with standard error', async (query) => {
    expect((await get().query(query).expect(400)).body).toMatchObject({
      statusCode: 400,
      error: 'Bad Request',
      path: expect.stringContaining('/api/v1/amenities'),
      timestamp: expect.any(String),
    });
  });
  it('returns empty results and leaves all data including orphan refs unchanged across reads', async () => {
    const before = await amenities.find().sort({ _id: 1 }).lean();
    const typeBefore = await types.find().sort({ _id: 1 }).lean();
    for (let i = 0; i < 3; i++)
      await get().query({ search: prefix }).expect(200);
    expect(
      (await get().query({ search: 'ABSENT-UC51' }).expect(200)).body,
    ).toEqual({ items: [], total: 0, page: 1, limit: 10 });
    expect(await amenities.find().sort({ _id: 1 }).lean()).toEqual(before);
    expect(await types.find().sort({ _id: 1 }).lean()).toEqual(typeBefore);
  });
  it('preserves existing options contract and has no DELETE endpoint', async () => {
    const result = await http()
      .get('/api/v1/amenities/options')
      .set(manager)
      .expect(200);
    expect(result.body).toContainEqual({
      id: String(attached),
      name: prefix + 'A.*[x]',
    });
    expect(
      result.body.some((row: { id: string }) => row.id === String(inactive)),
    ).toBe(false);
    for (const row of result.body)
      expect(Object.keys(row).sort()).toEqual(['id', 'name']);
    await http()
      .delete('/api/v1/amenities/' + attached)
      .set(manager)
      .expect(404);
  });
  it('seeds twice without duplicating or overwriting Manager edits, including timestamps', async () => {
    await seedAmenities(app);
    await seedRoomTypes(app);
    const sample = await amenities.findOne({ name: 'Wi-Fi' }).orFail();
    await amenities.updateOne(
      { _id: sample._id },
      { $set: { description: 'Manager edited', isActive: false } },
    );
    const before = await amenities.find().sort({ _id: 1 }).lean();
    const count = await amenities.countDocuments();
    await seedAmenities(app);
    await seedAmenities(app);
    expect(await amenities.countDocuments()).toBe(count);
    expect(await amenities.find().sort({ _id: 1 }).lean()).toEqual(before);
    const list = (await get().query({ limit: 100 }).expect(200)).body.items;
    expect(
      list.some((row: { roomTypeCount: number }) => row.roomTypeCount > 1),
    ).toBe(true);
    expect(
      list.some((row: { roomTypeCount: number }) => row.roomTypeCount === 0),
    ).toBe(true);
    expect(list.some((row: { isActive: boolean }) => !row.isActive)).toBe(true);
  });
  it('documents list query/response and preserves options', () => {
    const doc = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle('UC51').build(),
    );
    expect(doc.paths['/api/v1/amenities'].get?.responses).toHaveProperty('200');
    expect(doc.paths['/api/v1/amenities/options'].get).toBeDefined();
    expect(doc.components?.schemas?.AmenityResponse).toHaveProperty(
      'properties.roomTypes',
    );
    expect(doc.components?.schemas?.AmenityResponse).toHaveProperty(
      'properties.roomTypeCount',
    );
  });
});
