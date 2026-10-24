import { randomUUID } from 'node:crypto';
import { VersioningType, type INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { Model, Types } from 'mongoose';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import {
  Booking,
  BookingStatus,
} from '../src/modules/bookings/schemas/booking.schema.js';
import { Service } from '../src/modules/services/schemas/service.schema.js';
import { ServiceOrder } from '../src/modules/service-orders/schemas/service-order.schema.js';
import { assertTestDatabase } from './test-database.js';

describe('UC22/23 customer service orders', () => {
  let app: INestApplication;
  let bookings: Model<Booking>;
  let services: Model<Service>;
  let orders: Model<ServiceOrder>;
  let bookingId: string;
  let serviceId: string;
  const customer = new Types.ObjectId();
  const other = new Types.ObjectId();
  const originalUri = process.env.MONGODB_URI;
  const auth = { 'x-dev-role': 'CUSTOMER', 'x-dev-user-id': String(customer) };
  const http = () => request(app.getHttpServer());
  const post = (body: object) =>
    http().post('/api/v1/service-orders').set(auth).send(body);
  const get = (path: string) =>
    http()
      .get('/api/v1/service-orders' + path)
      .set(auth);
  const body = () => ({ bookingId, serviceId, quantity: 2 });

  beforeAll(async () => {
    assertTestDatabase(originalUri);
    const uri = new URL(originalUri!);
    uri.pathname = `/hms_serviceorders_${randomUUID().replaceAll('-', '')}_test`;
    process.env.MONGODB_URI = uri.toString();
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    await app.init();
    bookings = app.get(getModelToken(Booking.name));
    services = app.get(getModelToken(Service.name));
    orders = app.get(getModelToken(ServiceOrder.name));
    await Promise.all([bookings.init(), services.init(), orders.init()]);
  }, 60000);

  beforeEach(async () => {
    await Promise.all([
      bookings.deleteMany({}),
      services.deleteMany({}),
      orders.deleteMany({}),
    ]);
    const booking = await bookings.create({
      code: randomUUID(),
      customer,
      guestName: 'Fixture',
      guestEmail: 'fixture@example.com',
      guestPhone: '0123456789',
      rooms: [new Types.ObjectId()],
      checkIn: new Date('2026-01-01'),
      checkOut: new Date('2026-01-10'),
      guests: 1,
      status: BookingStatus.CheckedIn,
      roomTotal: 0,
      depositAmount: 0,
    });
    bookingId = String(booking._id);
    const service = await services.create({
      name: 'Laundry.*',
      unit: 'kg',
      billable: true,
      price: 50000,
    });
    serviceId = String(service._id);
  });

  afterAll(async () => {
    if (orders) await orders.db.dropDatabase();
    await app?.close();
    if (originalUri === undefined) delete process.env.MONGODB_URI;
    else process.env.MONGODB_URI = originalUri;
  });

  it('requires authentication and Customer role on every route', async () => {
    for (const path of [
      '',
      '/me',
      '/order-contexts',
      '/catalog',
      '/' + new Types.ObjectId(),
    ]) {
      const method = path === '' ? 'post' : 'get';
      await http()
        [method]('/api/v1/service-orders' + path)
        .send(body())
        .expect(401);
      for (const role of [
        'MANAGER',
        'RECEPTIONIST',
        'SERVICE_STAFF',
        'OPERATIONS_STAFF',
      ])
        await http()
          [method]('/api/v1/service-orders' + path)
          .set({ 'x-dev-role': role })
          .send(body())
          .expect(403);
    }
  });

  it('snapshots safe fields, starts pending/not started, has no charge/task side effects', async () => {
    const result = await post({ ...body(), notes: '  folded  ' }).expect(201);
    expect(result.body).toMatchObject({
      bookingId,
      serviceId,
      quantity: 2,
      unitPriceVND: 50000,
      amount: 100000,
      service: { name: 'Laundry.*', unit: 'kg' },
      notes: 'folded',
      reviewStatus: 'PENDING_REVIEW',
      executionStatus: 'NOT_STARTED',
    });
    expect(Object.keys(result.body).sort()).toEqual(
      [
        'id',
        'bookingId',
        'serviceId',
        'service',
        'quantity',
        'unitPriceVND',
        'amount',
        'requestedTime',
        'reviewStatus',
        'executionStatus',
        'notes',
        'createdAt',
      ].sort(),
    );
    await services.updateOne(
      { _id: serviceId },
      { price: 90000, name: 'Changed', unit: 'bag', isActive: false },
    );
    const detail = await get('/' + result.body.id).expect(200);
    expect(detail.body).toEqual(result.body);
    expect(await orders.db.collection('tasks').countDocuments()).toBe(0);
    expect(await orders.db.collection('invoices').countDocuments()).toBe(0);
    expect(orders.collection.collectionName).toBe('serviceorders');
  });

  it('rejects invalid quantities, IDs, dates, nulls and all client-controlled extras', async () => {
    for (const quantity of [0, -1, 1.5, '2', Number.MAX_SAFE_INTEGER + 1, null])
      await post({ ...body(), quantity }).expect(400);
    for (const extra of [
      'price',
      'unitPriceVND',
      'amount',
      'customer',
      'reviewStatus',
      'executionStatus',
      'title',
      'serviceName',
      'unit',
    ])
      await post({ ...body(), [extra]: 'forbidden' }).expect(400);
    for (const invalid of [
      { bookingId: 'bad' },
      { serviceId: 'bad' },
      { requestedTime: 'invalid' },
      { requestedTime: '2026-02-30T12:00:00Z' },
      { requestedTime: null },
      { notes: null },
      { requestId: 'bad' },
    ])
      await post({ ...body(), ...invalid }).expect(400);
    await get('/bad').expect(400);
  });

  it('enforces ownership, active checked-in booking, missing and inactive service', async () => {
    await bookings.updateOne({ _id: bookingId }, { customer: other });
    await post(body()).expect(404);
    await bookings.updateOne({ _id: bookingId }, { customer, isActive: false });
    await post(body()).expect(409);
    await bookings.updateOne(
      { _id: bookingId },
      { isActive: true, status: BookingStatus.CheckedOut },
    );
    await post(body()).expect(409);
    await bookings.updateOne(
      { _id: bookingId },
      { status: BookingStatus.CheckedIn },
    );
    await post({ ...body(), serviceId: String(new Types.ObjectId()) }).expect(
      404,
    );
    await services.updateOne({ _id: serviceId }, { isActive: false });
    await post(body()).expect(409);
  });

  it('supports nonbillable, zero-price and safe quantities above 1000; rejects monetary overflow', async () => {
    await services.updateOne(
      { _id: serviceId },
      { billable: false, price: null },
    );
    const free = await post({
      ...body(),
      quantity: Number.MAX_SAFE_INTEGER,
    }).expect(201);
    expect(free.body.amount).toBe(0);
    await services.updateOne({ _id: serviceId }, { billable: true, price: 0 });
    expect(
      (await post({ ...body(), quantity: 1001 }).expect(201)).body.amount,
    ).toBe(0);
    await services.updateOne(
      { _id: serviceId },
      { price: Number.MAX_SAFE_INTEGER },
    );
    await post(body()).expect(400);
  });

  it('accepts the H4 default empty service unit without inventing a required unit', async () => {
    await services.updateOne({ _id: serviceId }, { unit: '' });
    const result = await post(body()).expect(201);
    expect(result.body.service.unit).toBe('');
  });

  it('allows repeated orders without keys and guarantees real unique-index concurrent idempotency', async () => {
    const a = await post(body()).expect(201);
    const b = await post(body()).expect(201);
    expect(a.body.id).not.toBe(b.body.id);
    const requestId = randomUUID();
    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        post({ ...body(), requestId }).expect(201),
      ),
    );
    expect(new Set(results.map((row) => row.body.id)).size).toBe(1);
    expect(await orders.countDocuments()).toBe(3);
    const indexes = await orders.collection.indexes();
    expect(indexes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: { customer: 1, requestId: 1 },
          unique: true,
          partialFilterExpression: { requestId: { $exists: true } },
        }),
      ]),
    );
    await services.updateOne(
      { _id: serviceId },
      { price: 99999, isActive: false },
    );
    expect((await post({ ...body(), requestId }).expect(201)).body).toEqual(
      results[0].body,
    );
    await post({ ...body(), quantity: 3, requestId }).expect(409);
    await bookings.updateOne({ _id: bookingId }, { customer: other });
    await post({ ...body(), requestId }).expect(404);
  });

  it('normalizes explicit time/notes and keeps omitted requestedTime stable on retry', async () => {
    const requestId = randomUUID();
    const a = await post({
      ...body(),
      requestId,
      notes: ' hi ',
      requestedTime: '2026-01-03T12:00:00+07:00',
    }).expect(201);
    const b = await post({
      ...body(),
      requestId,
      notes: 'hi',
      requestedTime: '2026-01-03T05:00:00Z',
    }).expect(201);
    expect(b.body).toEqual(a.body);
    await post({ ...body(), requestId, notes: 'hi' }).expect(409);
  });

  it('lists/filter/paginates safely and denies both original-customer and current-booking IDOR', async () => {
    const a = await post(body()).expect(201);
    await post(body()).expect(201);
    expect(
      (
        await get('/me')
          .query({
            keyword: 'laundry.*',
            reviewStatus: 'PENDING_REVIEW',
            executionStatus: 'NOT_STARTED',
            page: 2,
            limit: 1,
          })
          .expect(200)
      ).body,
    ).toMatchObject({
      total: 2,
      page: 2,
      limit: 1,
      items: [expect.any(Object)],
    });
    for (const query of [
      { reviewStatus: 'ACCEPTED' },
      { executionStatus: 'COMPLETED' },
      { limit: 101 },
      { page: 0 },
      { extra: 'x' },
    ])
      await get('/me').query(query).expect(400);
    await http()
      .get('/api/v1/service-orders/' + a.body.id)
      .set({ ...auth, 'x-dev-user-id': String(other) })
      .expect(404);
    await bookings.updateOne({ _id: bookingId }, { customer: other });
    await get('/' + a.body.id).expect(404);
    expect((await get('/me').expect(200)).body.total).toBe(0);
    await http()
      .get('/api/v1/service-orders/' + a.body.id)
      .set({ ...auth, 'x-dev-user-id': String(other) })
      .expect(404);
  });

  it('provides only own checked-in context and active safe customer catalog', async () => {
    const contexts = await get('/order-contexts').expect(200);
    expect(contexts.body.items).toHaveLength(1);
    expect(Object.keys(contexts.body.items[0]).sort()).toEqual(
      ['id', 'code', 'checkIn', 'checkOut'].sort(),
    );
    const catalog = await get('/catalog').expect(200);
    expect(catalog.body.items).toEqual([
      {
        id: serviceId,
        name: 'Laundry.*',
        unit: 'kg',
        description: '',
        billable: true,
        unitPriceVND: 50000,
      },
    ]);
    await services.updateOne({ _id: serviceId }, { isActive: false });
    expect((await get('/catalog').expect(200)).body.items).toEqual([]);
    await bookings.updateOne(
      { _id: bookingId },
      { status: BookingStatus.CheckedOut },
    );
    expect((await get('/order-contexts').expect(200)).body.items).toEqual([]);
  });
});
