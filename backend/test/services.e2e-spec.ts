import { randomUUID } from 'node:crypto';
import { VersioningType, type INestApplication } from '@nestjs/common';
import { MODULE_METADATA } from '@nestjs/common/constants.js';
import { getModelToken, MongooseModule } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { Model, Types } from 'mongoose';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import {
  Service,
  SERVICE_COLLECTION_VALIDATOR,
} from '../src/modules/services/schemas/service.schema.js';
import { ServicesModule } from '../src/modules/services/services.module.js';
import { ServicesService } from '../src/modules/services/services.service.js';
import {
  SERVICE_SEED_SAMPLES,
  seedServices,
} from '../src/modules/services/seed.js';
import { assertTestDatabase } from './test-database.js';

describe('UC53 Service list and H4 (real AppModule)', () => {
  let app: INestApplication;
  let services: Model<Service>;
  const originalUri = process.env.MONGODB_URI;
  const prefix = 'UC53-E2E-';
  const manager = { 'x-dev-role': 'MANAGER' };
  const http = () => request(app.getHttpServer());
  const get = () => http().get('/api/v1/services').set(manager);
  beforeAll(async () => {
    assertTestDatabase(originalUri);
    const uri = new URL(originalUri!);
    uri.pathname = `/hms_uc53_${randomUUID().replaceAll('-', '')}_test`;
    process.env.MONGODB_URI = uri.toString();
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    await app.init();
    services = app.get(getModelToken(Service.name));
    await services.init();
    await services.create(
      [
        {
          name: prefix + 'A.*[x]',
          description: 'Full description',
          unit: 'lần',
          billable: true,
          price: 50000,
          isActive: true,
        },
        { name: prefix + 'B', billable: true, price: 0, isActive: true },
        { name: prefix + 'C', billable: false, price: null, isActive: true },
        { name: prefix + 'D', billable: true, price: null, isActive: false },
        {
          name: prefix + 'E',
          unit: 'suất',
          billable: true,
          price: 150000,
          isActive: true,
        },
      ].map((row, index) => ({
        ...row,
        createdAt: new Date(Date.UTC(2026, 0, index + 1)),
      })),
    );
    await services.collection.insertOne({
      name: prefix + 'F',
      billable: false,
      isActive: true,
      createdAt: new Date('2026-01-06T00:00:00Z'),
    } as never);
  }, 60000);
  afterAll(async () => {
    if (services) await services.deleteMany({ name: { $regex: '^' + prefix } });
    await app?.close();
    if (originalUri === undefined) delete process.env.MONGODB_URI;
    else process.env.MONGODB_URI = originalUri;
  });
  it('exports H4 provider/model and creates the collection with a server-side validator', async () => {
    expect(app.get(ServicesService)).toBeInstanceOf(ServicesService);
    expect(
      Reflect.getMetadata(MODULE_METADATA.EXPORTS, ServicesModule),
    ).toEqual(expect.arrayContaining([ServicesService, MongooseModule]));
    const collection = await services.db
      .db!.listCollections({ name: 'services' })
      .next();
    expect(collection?.options?.validator).toEqual(
      SERVICE_COLLECTION_VALIDATOR,
    );
    expect(collection?.options).toMatchObject({
      validationLevel: 'strict',
      validationAction: 'error',
    });
  });
  it('requires authentication and rejects all four other system roles', async () => {
    await http().get('/api/v1/services').expect(401);
    for (const role of [
      'CUSTOMER',
      'RECEPTIONIST',
      'SERVICE_STAFF',
      'OPERATIONS_STAFF',
    ])
      await http()
        .get('/api/v1/services')
        .set({ 'x-dev-role': role })
        .expect(403);
  });
  it('returns Manager data including inactive, zero, null and absent-price normalization', async () => {
    const result = await get().query({ search: prefix }).expect(200);
    expect(result.body).toMatchObject({ total: 6, page: 1, limit: 10 });
    expect(result.body.items[0]).toMatchObject({
      name: prefix + 'A.*[x]',
      description: 'Full description',
      unit: 'lần',
      billable: true,
      price: 50000,
      isActive: true,
    });
    expect(result.body.items[1].price).toBe(0);
    expect(result.body.items[3]).toMatchObject({
      billable: true,
      price: null,
      isActive: false,
    });
    expect(result.body.items[5]).toMatchObject({
      description: '',
      unit: '',
      price: null,
    });
    for (const row of result.body.items)
      expect(Object.keys(row).sort()).toEqual([
        'billable',
        'description',
        'id',
        'isActive',
        'name',
        'price',
        'unit',
      ]);
  });
  it('supports escaped case-insensitive search, both boolean filters, page and sorts', async () => {
    expect(
      (
        await get()
          .query({ search: prefix.toLowerCase() + 'a.*[X]' })
          .expect(200)
      ).body.total,
    ).toBe(1);
    expect(
      (await get().query({ search: prefix, billable: false }).expect(200)).body
        .total,
    ).toBe(2);
    expect(
      (
        await get()
          .query({ search: prefix, billable: true, isActive: false })
          .expect(200)
      ).body.items,
    ).toEqual([expect.objectContaining({ name: prefix + 'D' })]);
    const page = await get()
      .query({ search: prefix, page: 2, limit: 2 })
      .expect(200);
    expect(page.body).toMatchObject({ total: 6, page: 2, limit: 2 });
    expect(page.body.items.map((row: { name: string }) => row.name)).toEqual([
      prefix + 'C',
      prefix + 'D',
    ]);
    for (const sortBy of ['name', 'createdAt'])
      expect(
        (
          await get()
            .query({ search: prefix, sortBy, sortOrder: 'desc' })
            .expect(200)
        ).body.items[0].name,
      ).toBe(prefix + 'F');
  });
  it.each(['asc', 'desc'])(
    'places null and absent prices last when sorting %s, including across pages',
    async (sortOrder) => {
      const result = await get()
        .query({ search: prefix, sortBy: 'price', sortOrder })
        .expect(200);
      expect(
        result.body.items.map((row: { price: number | null }) => row.price),
      ).toEqual(
        sortOrder === 'asc'
          ? [0, 50000, 150000, null, null, null]
          : [150000, 50000, 0, null, null, null],
      );
      const pages = [];
      for (let page = 1; page <= 3; page++)
        pages.push(
          ...(
            await get()
              .query({
                search: prefix,
                sortBy: 'price',
                sortOrder,
                page,
                limit: 2,
              })
              .expect(200)
          ).body.items,
        );
      expect(pages.map((row) => row.id)).toEqual(
        result.body.items.map((row: { id: string }) => row.id),
      );
    },
  );
  it.each([
    { page: 0 },
    { page: 1.5 },
    { limit: 1000 },
    { limit: 0 },
    { billable: 'yes' },
    { isActive: '0' },
    { sortBy: 'unknown' },
    { sortOrder: 'up' },
    { unknown: 1 },
    { search: 'x'.repeat(101) },
  ])('rejects invalid query %j with the standard envelope', async (query) => {
    expect((await get().query(query).expect(400)).body).toMatchObject({
      statusCode: 400,
      error: 'Bad Request',
      path: expect.stringContaining('/api/v1/services'),
      timestamp: expect.any(String),
    });
  });
  it('keeps list reads read only, returns empty pages and has no DELETE route', async () => {
    const before = await services.find().sort({ _id: 1 }).lean();
    for (let i = 0; i < 3; i++)
      await get().query({ search: prefix }).expect(200);
    expect(
      (await get().query({ search: 'ABSENT-UC53' }).expect(200)).body,
    ).toEqual({ items: [], total: 0, page: 1, limit: 10 });
    expect(
      (await get().query({ search: prefix, page: 99 }).expect(200)).body,
    ).toMatchObject({ items: [], total: 6, page: 99 });
    const id = String(new Types.ObjectId());
    await http()
      .delete('/api/v1/services/' + id)
      .set(manager)
      .expect(404);
    await http()
      .get('/api/v1/services/' + id)
      .set(manager)
      .expect(404);
    expect(await services.find().sort({ _id: 1 }).lean()).toEqual(before);
  });
  it('enforces unique names with the existing case-sensitive convention', async () => {
    await expect(
      services.create({ name: prefix + 'B', price: 0 }),
    ).rejects.toMatchObject({ code: 11000 });
    const lower = await services.create({ name: prefix + 'b', price: 0 });
    await services.deleteOne({ _id: lower._id });
  });
  it('enforces BR-FAC-08 for queries, bulkWrite, pipelines and raw driver writes without runValidators', async () => {
    const draft = await services.create({
      name: prefix + 'Guard',
      billable: true,
      isActive: false,
    });
    try {
      await expect(
        services.updateOne({ _id: draft._id }, { $set: { isActive: true } }),
      ).rejects.toMatchObject({ code: 121 });
      await expect(
        services.updateMany({ _id: draft._id }, { $set: { isActive: true } }),
      ).rejects.toMatchObject({ code: 121 });
      await expect(
        services.findOneAndUpdate(
          { _id: draft._id },
          { $set: { isActive: true } },
        ),
      ).rejects.toMatchObject({ code: 121 });
      await expect(
        services.bulkWrite([
          {
            updateOne: {
              filter: { _id: draft._id },
              update: { $set: { isActive: true } },
            },
          },
        ]),
      ).rejects.toMatchObject({ code: 121 });
      await expect(
        services.updateOne({ _id: draft._id }, [{ $set: { isActive: true } }], {
          updatePipeline: true,
        }),
      ).rejects.toMatchObject({ code: 121 });
      await expect(
        services.replaceOne(
          { _id: draft._id },
          { name: draft.name, billable: true, isActive: true, price: null },
        ),
      ).rejects.toThrow();
      await expect(
        services.collection.insertOne({
          name: prefix + 'Invalid',
          billable: true,
          isActive: true,
          price: 1.5,
        } as never),
      ).rejects.toMatchObject({ code: 121 });
      await expect(
        services.collection.updateOne({ _id: draft._id }, {
          $set: { price: '0' },
        } as never),
      ).rejects.toMatchObject({ code: 121 });
      expect((await services.findById(draft._id).lean())!.isActive).toBe(false);
      await services.updateOne(
        { _id: draft._id },
        { $set: { isActive: true, price: 0 } },
      );
      expect((await services.findById(draft._id).lean())!.price).toBe(0);
    } finally {
      await services.deleteOne({ _id: draft._id });
    }
  });
  it('seeds twice without duplicating or overwriting any Manager fields/timestamps', async () => {
    await seedServices(app);
    for (const sample of SERVICE_SEED_SAMPLES)
      expect(await services.exists({ name: sample.name })).not.toBeNull();
    const sample = await services.findOne({ name: 'Giặt ủi' }).orFail();
    await services.updateOne(
      { _id: sample._id },
      {
        $set: {
          description: 'Manager edited',
          unit: 'kg',
          billable: false,
          price: null,
          isActive: false,
        },
      },
    );
    const before = await services.find().sort({ _id: 1 }).lean();
    await seedServices(app);
    await seedServices(app);
    expect(await services.find().sort({ _id: 1 }).lean()).toEqual(before);
    for (const row of await services.find())
      await expect(row.validate()).resolves.toBeUndefined();
  });
  it('preserves list fields and query documentation', () => {
    const doc = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle('UC53').build(),
    );
    expect(doc.paths['/api/v1/services'].get?.responses).toHaveProperty('200');
    for (const status of ['400', '401', '403'])
      expect(doc.paths['/api/v1/services'].get?.responses).toHaveProperty(
        status,
      );
    expect(
      Object.keys(doc.components!.schemas!.ServiceResponse.properties!).sort(),
    ).toEqual([
      'billable',
      'description',
      'id',
      'imageUrl',
      'isActive',
      'name',
      'price',
      'unit',
    ]);
  });
});
