import { VersioningType, type INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { type Model, Types } from 'mongoose';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { Amenity } from '../src/modules/amenities/schemas/amenity.schema.js';
import { RoomType } from '../src/modules/room-types/schemas/room-type.schema.js';
import { seedAmenities } from '../src/modules/amenities/seed.js';
import { seedRoomTypes } from '../src/modules/room-types/seed.js';

describe('UC49 room types (e2e)', () => {
  let app: INestApplication;
  let types: Model<RoomType>;
  let amenities: Model<Amenity>;
  const manager = { 'x-dev-role': 'MANAGER' };
  const prefix = 'UC49-E2E-';
  const http = () => request(app.getHttpServer());
  const get = () => http().get('/api/v1/room-types').set(manager);
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    await app.init();
    types = app.get(getModelToken(RoomType.name));
    amenities = app.get(getModelToken(Amenity.name));
    await types.init();
    await amenities.init();
    const amenity = await amenities.create({ name: prefix + 'Wi-Fi' });
    await types.create([
      {
        name: prefix + 'Standard.*',
        capacity: 2,
        basePrice: 850000,
        amenities: [amenity._id, new Types.ObjectId()],
      },
      {
        name: prefix + 'Suite',
        capacity: 4,
        basePrice: 2800000,
        isActive: false,
      },
    ]);
  }, 30000);
  afterAll(async () => {
    if (types) await types.deleteMany({ name: { $regex: '^' + prefix } });
    if (amenities)
      await amenities.deleteMany({ name: { $regex: '^' + prefix } });
    await app?.close();
  });

  it('requires authentication and denies the four other system roles', async () => {
    await http().get('/api/v1/room-types').expect(401);
    for (const role of [
      'CUSTOMER',
      'RECEPTIONIST',
      'SERVICE_STAFF',
      'OPERATIONS_STAFF',
    ]) {
      await http()
        .get('/api/v1/room-types')
        .set({ 'x-dev-role': role })
        .expect(403);
    }
  });
  it('lists inactive types too, populates existing amenities, and searches literally', async () => {
    const all = await get().query({ search: prefix }).expect(200);
    expect(all.body.total).toBe(2);
    expect(all.body.items.some((item: RoomType) => !item.isActive)).toBe(true);
    const result = await get().query({ search: 'standard.*' }).expect(200);
    expect(result.body.total).toBe(1);
    expect(result.body.items[0]).toMatchObject({
      name: prefix + 'Standard.*',
      availableForBooking: true,
      amenities: [{ name: prefix + 'Wi-Fi' }],
    });
    expect(result.body.items[0]).not.toHaveProperty('_id');
    const inactive = await get()
      .query({ search: prefix, isActive: 'false' })
      .expect(200);
    expect(inactive.body.items[0].availableForBooking).toBe(false);
  });
  it('sorts and paginates while retaining total', async () => {
    const result = await get()
      .query({
        search: prefix,
        sortBy: 'basePrice',
        sortOrder: 'desc',
        page: 2,
        limit: 1,
      })
      .expect(200);
    expect(result.body).toMatchObject({ total: 2, page: 2, limit: 1 });
    expect(result.body.items[0].basePrice).toBe(850000);
  });
  it.each([
    { page: 0 },
    { limit: 1000 },
    { unexpected: 'x' },
    { isActive: 'yes' },
    { sortBy: 'secret' },
    { sortOrder: 'wrong' },
  ])('rejects invalid query %j', async (query) => {
    const response = await get().query(query).expect(400);
    expect(response.body).toMatchObject({
      statusCode: 400,
      path: '/api/v1/room-types' + response.request.url.split('/room-types')[1],
    });
  });
  it('returns an empty list for no matches and never mutates read data', async () => {
    const before = await types
      .find({ name: { $regex: '^' + prefix } })
      .sort({ name: 1 })
      .lean();
    await get().query({ search: prefix }).expect(200);
    await get().query({ search: prefix }).expect(200);
    const empty = await get()
      .query({ search: prefix + 'absent' })
      .expect(200);
    expect(empty.body).toEqual({ items: [], total: 0, page: 1, limit: 10 });
    expect(
      await types
        .find({ name: { $regex: '^' + prefix } })
        .sort({ name: 1 })
        .lean(),
    ).toEqual(before);
  });
  it('enforces unique names in Mongo, not only schema metadata', async () => {
    await expect(
      types.create({ name: prefix + 'Suite', capacity: 1, basePrice: 1 }),
    ).rejects.toMatchObject({ code: 11000 });
    await expect(
      amenities.create({ name: prefix + 'Wi-Fi' }),
    ).rejects.toMatchObject({ code: 11000 });
  });
  it('runs facility seeds twice without duplicates or overwriting edits', async () => {
    // Seed only this feature: do not create users/bookings owned by other suites.
    await seedAmenities(app);
    await seedRoomTypes(app);
    const firstTypes = await types.countDocuments();
    const firstAmenities = await amenities.countDocuments();
    const sample = await types.findOne({ name: 'Standard' }).lean();
    await types.updateOne(
      { _id: sample!._id },
      { $set: { description: 'UC49 edited description' } },
    );
    await seedAmenities(app);
    await seedRoomTypes(app);
    await seedAmenities(app);
    await seedRoomTypes(app);
    expect(await types.countDocuments()).toBe(firstTypes);
    expect(await amenities.countDocuments()).toBe(firstAmenities);
    expect((await types.findById(sample!._id))?.description).toBe(
      'UC49 edited description',
    );
  }, 30000);
  it('documents the query and response schema in Swagger', () => {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle('UC49 test').build(),
    );
    const operation = document.paths['/api/v1/room-types'].get!;
    expect(operation.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'sortBy' }),
        expect.objectContaining({ name: 'isActive' }),
      ]),
    );
    expect(document.components?.schemas?.RoomTypeResponse).toHaveProperty(
      'properties.availableForBooking',
    );
  });
});
