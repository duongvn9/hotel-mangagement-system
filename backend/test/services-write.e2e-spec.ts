import { randomUUID } from 'node:crypto';
import { VersioningType, type INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { Model, Types } from 'mongoose';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { Service } from '../src/modules/services/schemas/service.schema.js';
import { ServicesService } from '../src/modules/services/services.service.js';
import { seedServices } from '../src/modules/services/seed.js';
import { assertTestDatabase } from './test-database.js';
import { AssetImagesService } from '../src/common/asset-images.service.js';
import { ServicesModule } from '../src/modules/services/services.module.js';
describe('UC54 service writes with real AppModule', () => {
  let app: INestApplication;
  let model: Model<Service>;
  let service: ServicesService;
  const originalUri = process.env.MONGODB_URI;
  const prefix = 'UC54-E2E-';
  const manager = { 'x-dev-role': 'MANAGER' };
  const http = () => request(app.getHttpServer());
  const post = (body: object) =>
    http().post('/api/v1/services').set(manager).send(body);
  const patch = (id: string, body: object) =>
    http()
      .patch('/api/v1/services/' + id)
      .set(manager)
      .send(body);
  const detail = (id: string) =>
    http()
      .get('/api/v1/services/' + id)
      .set(manager);
  beforeAll(async () => {
    assertTestDatabase(originalUri);
    const uri = new URL(originalUri!);
    uri.pathname = `/hms_uc54_${randomUUID().replaceAll('-', '')}_test`;
    process.env.MONGODB_URI = uri.toString();
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    await app.init();
    model = app.get(getModelToken(Service.name));
    service = app.get(ServicesService);
    await model.init();
  }, 60000);
  afterAll(async () => {
    if (model) await model.deleteMany({ name: { $regex: '^' + prefix } });
    await app?.close();
    if (originalUri === undefined) delete process.env.MONGODB_URI;
    else process.env.MONGODB_URI = originalUri;
  });
  it('restricts image upload and uses the service storage prefix', async () => {
    const upload = vi
      .spyOn(
        app.select(ServicesModule).get(AssetImagesService, { strict: true }),
        'upload',
      )
      .mockResolvedValue({ path: '/images/seeds/services/upload.jpg' });
    try {
      await http()
        .post('/api/v1/services/images')
        .attach('file', Buffer.from([255, 216, 255]), 'photo.jpg')
        .expect(401);
      await http()
        .post('/api/v1/services/images')
        .set('x-dev-role', 'CUSTOMER')
        .attach('file', Buffer.from([255, 216, 255]), 'photo.jpg')
        .expect(403);
      expect(upload).not.toHaveBeenCalled();
      const response = await http()
        .post('/api/v1/services/images')
        .set(manager)
        .attach('file', Buffer.from([255, 216, 255]), 'photo.jpg')
        .expect(201);
      expect(response.body.path).toBe('/images/seeds/services/upload.jpg');
      expect(upload).toHaveBeenCalledWith(
        expect.objectContaining({ mimetype: 'image/jpeg' }),
        'services',
      );
    } finally {
      upload.mockRestore();
    }
  });
  it('persists, replaces and clears the service photo while preserving other fields', async () => {
    const created = await post({
      name: prefix + 'Photo',
      billable: true,
      price: 50000,
      imageUrl: '/images/seeds/services/first.jpg',
    }).expect(201);
    expect(created.body.imageUrl).toBe('/images/seeds/services/first.jpg');
    expect((await detail(created.body.id).expect(200)).body.imageUrl).toBe(
      created.body.imageUrl,
    );
    const replaced = await patch(created.body.id, {
      imageUrl: '/images/seeds/services/second.png',
    }).expect(200);
    expect(replaced.body).toMatchObject({
      imageUrl: '/images/seeds/services/second.png',
      price: 50000,
      billable: true,
    });
    const cleared = await patch(created.body.id, { imageUrl: '' }).expect(200);
    expect(cleared.body).toMatchObject({ imageUrl: '', price: 50000 });
    await patch(created.body.id, { imageUrl: ['a', 'b'] }).expect(400);
    await patch(created.body.id, {
      imageUrl: 'https://invalid.example.com/a.jpg',
    }).expect(400);
  });
  it('requires 401 and rejects every other system role for all new routes', async () => {
    for (const role of [
      undefined,
      'CUSTOMER',
      'RECEPTIONIST',
      'SERVICE_STAFF',
      'OPERATIONS_STAFF',
    ]) {
      const headers = role ? { 'x-dev-role': role } : {};
      const id = String(new Types.ObjectId());
      await http()
        .post('/api/v1/services')
        .set(headers)
        .send({ name: prefix + 'Denied', price: 0 })
        .expect(role ? 403 : 401);
      await http()
        .patch('/api/v1/services/' + id)
        .set(headers)
        .send({ isActive: false })
        .expect(role ? 403 : 401);
      await http()
        .get('/api/v1/services/' + id)
        .set(headers)
        .expect(role ? 403 : 401);
    }
  });
  it('creates all valid combinations and returns the list item contract', async () => {
    const inputs = [
      { name: 'Paid', price: 50000 },
      { name: 'Zero', price: 0 },
      { name: 'Free', billable: false },
      { name: 'Draft', isActive: false },
    ];
    for (const input of inputs) {
      const created = await post({
        ...input,
        name: ' ' + prefix + input.name + ' ',
        description: ' note ',
        unit: ' lần ',
      }).expect(201);
      expect(created.body).toMatchObject({
        name: prefix + input.name,
        description: 'note',
        unit: 'lần',
        price: input.price ?? null,
        billable: input.billable ?? true,
        isActive: input.isActive ?? true,
      });
      expect((await detail(created.body.id).expect(200)).body).toEqual(
        created.body,
      );
      expect(
        (await detail(created.body.id.toUpperCase()).expect(200)).body,
      ).toEqual(created.body);
      const list = await http()
        .get('/api/v1/services')
        .set(manager)
        .query({ search: prefix + input.name })
        .expect(200);
      expect(list.body.items).toEqual([created.body]);
    }
  });
  it.each([
    {},
    { name: ' ' },
    { name: 'x'.repeat(101) },
    { name: prefix + 'Invalid', price: -1 },
    { name: prefix + 'Invalid', price: 1.5 },
    { name: prefix + 'Invalid', price: '100' },
    { name: prefix + 'Invalid', price: Number.MAX_SAFE_INTEGER + 1 },
    { name: prefix + 'Invalid' },
    { name: prefix + 'Invalid', price: null },
    { name: prefix + 'Invalid', billable: 'false' },
    { name: prefix + 'Invalid', price: 0, unknown: 1 },
    { name: prefix + 'Invalid', price: 0, __v: 4 },
    { name: prefix + 'Invalid', price: 0, updatedAt: 'now' },
  ])('rejects invalid creation %j without any write', async (body) => {
    const before = await model.find().sort({ _id: 1 }).lean();
    const result = await post(body).expect(400);
    expect(result.body).toMatchObject({
      statusCode: 400,
      error: 'Bad Request',
      path: '/api/v1/services',
      timestamp: expect.any(String),
    });
    expect(await model.find().sort({ _id: 1 }).lean()).toEqual(before);
  });
  it('validates the merged state and preserves all fields on invalid activation/billable/price changes', async () => {
    const draft = (
      await post({ name: prefix + 'NoPrice', isActive: false }).expect(201)
    ).body;
    const free = (
      await post({ name: prefix + 'FreeNoPrice', billable: false }).expect(201)
    ).body;
    const paid = (
      await post({ name: prefix + 'HasPrice', price: 100 }).expect(201)
    ).body;
    for (const [id, body] of [
      [draft.id, { isActive: true }],
      [free.id, { billable: true }],
      [paid.id, { price: null }],
      [paid.id, { price: -1 }],
      [paid.id, { price: '1' }],
      [paid.id, { price: 1.5 }],
    ] as [string, object][]) {
      const before = await model.findById(id).lean();
      const result = await patch(id, {
        ...body,
        description: 'Do not save',
      }).expect(400);
      expect(String(result.body.message)).toMatch(/price/);
      expect(await model.findById(id).lean()).toEqual(before);
    }
    await patch(draft.id, { isActive: true, price: 0 }).expect(200);
    await patch(free.id, { billable: true, isActive: false }).expect(200);
    await patch(paid.id, { isActive: false, price: null }).expect(200);
  });
  it('patches only supplied fields, keeps price on billable changes, and deactivates idempotently', async () => {
    const created = (
      await post({ name: prefix + 'Partial', price: 0, unit: 'lần' }).expect(
        201,
      )
    ).body;
    expect(
      (await patch(created.id, { description: 'Changed' }).expect(200)).body,
    ).toEqual({ ...created, description: 'Changed' });
    expect(
      (await patch(created.id, { billable: false }).expect(200)).body.price,
    ).toBe(0);
    const first = (await patch(created.id, { isActive: false }).expect(200))
      .body;
    expect(
      (await patch(created.id, { isActive: false }).expect(200)).body,
    ).toEqual(first);
    expect(await model.exists({ _id: created.id })).not.toBeNull();
    const list = await http()
      .get('/api/v1/services')
      .set(manager)
      .query({ search: prefix + 'Partial', isActive: false })
      .expect(200);
    expect(list.body.items).toEqual([first]);
    for (const body of [
      {},
      { _id: created.id },
      { createdAt: 'now' },
      { __v: 99 },
      { name: null },
      { billable: null },
    ])
      await patch(created.id, body).expect(400);
    await http()
      .delete('/api/v1/services/' + created.id)
      .set(manager)
      .expect(404);
  });
  it('returns 409 for exact duplicate names including competing creates; preserves case-sensitive uniqueness', async () => {
    const name = prefix + 'Unique';
    const [one, two] = await Promise.all([
      post({ name, price: 0 }),
      post({ name, price: 0 }),
    ]);
    expect([one.status, two.status].sort()).toEqual([201, 409]);
    const other = (await post({ name: prefix + 'Other', price: 0 }).expect(201))
      .body;
    await patch(other.id, { name }).expect(409);
    await post({ name: prefix + 'unique', price: 0 }).expect(201);
  });
  it('returns 409 for a real version race and does not save the losing request', async () => {
    const row = (
      await post({ name: prefix + 'Concurrent', price: 100 }).expect(201)
    ).body;
    const original = model.findOneAndUpdate.bind(model);
    const spy = vi
      .spyOn(model, 'findOneAndUpdate')
      .mockImplementationOnce((...args) => {
        const q = original(...args);
        const exec = q.exec.bind(q);
        q.exec = async () => {
          await model.updateOne(
            { _id: row.id },
            { $set: { description: 'Concurrent winner' }, $inc: { __v: 1 } },
          );
          return exec();
        };
        return q;
      });
    try {
      const result = await patch(row.id, {
        name: prefix + 'MustNotSave',
        price: 0,
      }).expect(409);
      expect(result.body.message).toContain('Dữ liệu đã thay đổi');
      const current = (await detail(row.id)).body;
      expect(current).toMatchObject({
        name: row.name,
        price: 100,
        description: 'Concurrent winner',
      });
    } finally {
      spy.mockRestore();
    }
    await patch(row.id, { price: 0 }).expect(200);
  });
  it('handles missing/malformed IDs and provides the read-only H4 active lookup', async () => {
    await detail('bad').expect(400);
    await patch('bad', { name: 'X' }).expect(400);
    await detail(String(new Types.ObjectId())).expect(404);
    await patch(String(new Types.ObjectId()), { name: 'X' }).expect(404);
    const row = (await post({ name: prefix + 'Lookup', price: 0 }).expect(201))
      .body;
    const before = await model.findById(row.id).lean();
    expect(await service.findActiveById(row.id)).toEqual(row);
    expect(await service.findActiveById('bad')).toBeNull();
    expect(
      await service.findActiveById(String(new Types.ObjectId())),
    ).toBeNull();
    expect(await model.findById(row.id).lean()).toEqual(before);
    await patch(row.id, { isActive: false }).expect(200);
    expect(await service.findActiveById(row.id)).toBeNull();
  });
  it('seed twice preserves all Manager edits and metadata versions/timestamps', async () => {
    await seedServices(app);
    const sample = await model.findOne({ name: 'Giặt ủi' }).orFail();
    await patch(String(sample._id), {
      description: 'Manager UC54',
      unit: 'kg',
      billable: false,
      price: null,
      isActive: false,
    }).expect(200);
    const before = await model.find().sort({ _id: 1 }).lean();
    await seedServices(app);
    await seedServices(app);
    expect(await model.find().sort({ _id: 1 }).lean()).toEqual(before);
  });
  it('documents create/detail/partial update with responses and errors', () => {
    const doc = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle('UC54').build(),
    );
    expect(doc.paths['/api/v1/services'].post?.responses).toHaveProperty('201');
    for (const method of ['get', 'patch'] as const)
      expect(
        doc.paths['/api/v1/services/{id}'][method]?.responses,
      ).toHaveProperty('200');
    for (const code of ['400', '401', '403', '404', '409'])
      expect(
        doc.paths['/api/v1/services/{id}'].patch?.responses,
      ).toHaveProperty(code);
    expect(doc.components?.schemas?.UpdateServiceDto).toHaveProperty(
      'properties.price.nullable',
      true,
    );
  });
});
