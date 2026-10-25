import { randomUUID } from 'node:crypto';
import { Logger, VersioningType, type INestApplication } from '@nestjs/common';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Connection, Model, Types } from 'mongoose';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PaymentTransaction } from '../src/modules/payments/schemas/payment-transaction.schema.js';
import { User } from '../src/modules/users/schemas/user.schema.js';
import { RevenueReportClock } from '../src/modules/reports/revenue-report.service.js';
import { assertTestDatabase } from './test-database.js';
describe('UC56 revenue — real AppModule and Mongo aggregation', () => {
  let app: INestApplication,
    connection: Connection,
    payments: Model<PaymentTransaction>,
    users: Model<User>;
  const paymentIds: Types.ObjectId[] = [],
    userIds: Types.ObjectId[] = [];
  const original = process.env.MONGODB_URI;
  const base = '/api/v1/reports/revenue';
  const period = { from: '2026-10-01', to: '2026-10-03' };
  const now = new Date('2026-10-25T03:00:00Z');
  let manager: Types.ObjectId;
  const headers = (role = 'MANAGER', id = manager) => ({
    'x-dev-role': role,
    'x-dev-user-id': String(id),
  });
  const http = () => request(app.getHttpServer());
  const get = (query: object = period) =>
    http().get(base).set(headers()).query(query);
  async function fixture(extra: Record<string, unknown> = {}) {
    const row = await payments.create({
      booking: new Types.ObjectId(),
      invoice: new Types.ObjectId(),
      transactionRef: randomUUID(),
      method: 'VNPAY',
      purpose: 'DEPOSIT',
      status: 'SUCCESS',
      amount: 100,
      paidAt: new Date('2026-10-01T17:00:00Z'),
      createdAt: new Date('2026-10-02T03:00:00Z'),
      ...extra,
    });
    paymentIds.push(row._id);
    return row;
  }
  async function cleanup() {
    if (payments)
      await payments.deleteMany({ _id: { $in: paymentIds.splice(0) } });
  }
  beforeAll(async () => {
    assertTestDatabase(original);
    const uri = new URL(original!);
    uri.pathname = `/hms_uc56_${randomUUID().replaceAll('-', '')}_test`;
    process.env.MONGODB_URI = uri.toString();
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(RevenueReportClock)
      .useValue({ now: () => new Date(now) })
      .compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    SwaggerModule.setup(
      'api/docs',
      app,
      SwaggerModule.createDocument(
        app,
        new DocumentBuilder().setTitle('UC56').build(),
      ),
    );
    await app.init();
    connection = app.get(getConnectionToken());
    payments = app.get(getModelToken(PaymentTransaction.name));
    users = app.get(getModelToken(User.name));
    await Promise.all(
      Object.values(connection.models).map((model) => model.init()),
    );
    manager = (
      await users.create({
        email: 'uc56-manager@example.test',
        fullName: 'UC56 Manager',
        role: 'MANAGER',
      })
    )._id;
    userIds.push(manager);
  }, 60000);
  beforeEach(cleanup);
  afterEach(() => vi.restoreAllMocks());
  afterAll(async () => {
    await cleanup();
    if (users) await users.deleteMany({ _id: { $in: userIds } });
    await app?.close();
    if (original === undefined) delete process.env.MONGODB_URI;
    else process.env.MONGODB_URI = original;
  });
  it('separates cash/deposit/final and reconciles all breakdowns, never includes unsuccessful or inactive money', async () => {
    await fixture({ amount: 100001 });
    await fixture({ method: 'CASH', purpose: 'FINAL', amount: 234567 });
    for (const status of ['FAILED', 'CANCELLED', 'PENDING'])
      await fixture({ status, amount: 999999999, paidAt: undefined });
    await fixture({ isActive: false, amount: 999999 });
    await fixture({ paidAt: new Date('2026-10-03T17:00:00Z') });
    const { body } = await get().expect(200);
    expect(body.totals).toEqual({
      successCount: 2,
      successAmount: 334568,
      refunds: null,
      refundsSupported: false,
      netAmount: null,
      failedCount: 1,
      cancelledCount: 1,
      pendingCount: 1,
      anomalies: { count: 0 },
    });
    for (const rows of [body.byMethod, body.byPurpose, body.series])
      expect(
        rows.reduce(
          (sum: number, row: { successAmount: number }) =>
            sum + row.successAmount,
          0,
        ),
      ).toBe(334568);
    expect(body.byMethod.map((row: { method: string }) => row.method)).toEqual([
      'VNPAY',
      'CASH',
    ]);
    expect(
      body.byPurpose.map((row: { purpose: string }) => row.purpose),
    ).toEqual(['DEPOSIT', 'FINAL']);
    expect(body.generatedAt).toBe(now.toISOString());
  });
  it('applies method and purpose to successful, failed/cancelled/pending and anomalous transactions', async () => {
    for (const method of ['CASH', 'VNPAY'])
      for (const purpose of ['DEPOSIT', 'FINAL'])
        for (const status of ['SUCCESS', 'FAILED', 'CANCELLED', 'PENDING'])
          await fixture({ method, purpose, status });
    const bad = await fixture({ method: 'CASH', purpose: 'FINAL' });
    await payments.collection.updateOne(
      { _id: bad._id },
      { $set: { amount: -1 } },
    );
    const { body } = await get({
      ...period,
      method: 'CASH',
      purpose: 'FINAL',
    }).expect(200);
    expect(body.totals).toMatchObject({
      successCount: 1,
      successAmount: 100,
      failedCount: 1,
      cancelledCount: 1,
      pendingCount: 1,
      anomalies: { count: 1 },
    });
    expect(body.byMethod[0].successAmount).toBe(0);
    expect(body.byPurpose[0].successAmount).toBe(0);
  });
  it('uses paidAt for SUCCESS, createdAt for non-success, including when a failure has paidAt', async () => {
    await fixture({ createdAt: new Date('2020-01-01'), amount: 501 });
    await fixture({ status: 'FAILED', paidAt: new Date('2020-01-01') });
    await fixture({ status: 'CANCELLED', createdAt: new Date('2020-01-01') });
    const { body } = await get().expect(200);
    expect(body.totals).toMatchObject({
      successAmount: 501,
      failedCount: 1,
      cancelledCount: 0,
    });
  });
  it('includes both date ends and splits 16:59/17:00 UTC at Vietnam midnight', async () => {
    const dates = [
      '2026-09-30T16:59:59Z',
      '2026-09-30T17:00:00Z',
      '2026-10-01T16:59:59Z',
      '2026-10-01T17:00:00Z',
      '2026-10-03T16:59:59Z',
      '2026-10-03T17:00:00Z',
    ];
    for (const date of dates) await fixture({ paidAt: new Date(date) });
    const { body } = await get().expect(200);
    expect(
      body.series.map((row: { successCount: number }) => row.successCount),
    ).toEqual([2, 1, 1]);
    expect(body.totals.successAmount).toBe(400);
    expect(
      (await get({ from: period.from, to: period.from }).expect(200)).body
        .totals.successCount,
    ).toBe(2);
  });
  it('groups partial first/last months by Vietnam dates, zero-fills middle months', async () => {
    await fixture({ paidAt: new Date('2026-01-30T17:00:00Z'), amount: 101 });
    await fixture({ paidAt: new Date('2026-02-28T17:00:00Z'), amount: 202 });
    await fixture({ paidAt: new Date('2026-01-01'), amount: 999 });
    const { body } = await get({
      from: '2026-01-31',
      to: '2026-03-01',
      granularity: 'month',
    }).expect(200);
    expect(body.series).toEqual([
      { bucket: '2026-01', successCount: 1, successAmount: 101 },
      { bucket: '2026-02', successCount: 0, successAmount: 0 },
      { bucket: '2026-03', successCount: 1, successAmount: 202 },
    ]);
  });
  it('supports empty, one-day and 366-day reports with continuous zero series', async () => {
    const { body } = await get({ from: '2024-01-01', to: '2024-12-31' }).expect(
      200,
    );
    expect(body.series).toHaveLength(366);
    expect(
      body.series.every(
        (row: { successAmount: number }) => row.successAmount === 0,
      ),
    ).toBe(true);
    expect(body.totals).toMatchObject({
      successCount: 0,
      successAmount: 0,
      refunds: null,
      refundsSupported: false,
      netAmount: null,
      anomalies: { count: 0 },
    });
    expect(
      (await get({ from: period.from, to: period.from }).expect(200)).body
        .series,
    ).toHaveLength(1);
  });
  it('excludes malformed successes and scopes missing paidAt anomalies by createdAt, warning without private data', async () => {
    const warn = vi.spyOn(Logger.prototype, 'warn');
    for (const amount of [
      -1,
      1.25,
      null,
      'oops',
      Number.MAX_SAFE_INTEGER + 1,
    ]) {
      const row = await fixture();
      await payments.collection.updateOne(
        { _id: row._id },
        { $set: { amount } },
      );
    }
    await fixture({ paidAt: undefined });
    await fixture({ paidAt: undefined, createdAt: new Date('2020-01-01') });
    await fixture({ amount: 77 });
    const { body } = await get().expect(200);
    expect(body.totals).toMatchObject({
      successCount: 1,
      successAmount: 77,
      anomalies: { count: 6 },
    });
    expect(warn).toHaveBeenCalledWith({
      event: 'revenue_report_anomalies',
      count: 6,
    });
  });
  it('preserves large integer VND and rejects overflow totals', async () => {
    await fixture({ amount: 1234567890123 });
    expect((await get().expect(200)).body.totals.successAmount).toBe(
      1234567890123,
    );
    await fixture({ amount: Number.MAX_SAFE_INTEGER });
    await get().expect(503);
  });
  it('performs exactly one aggregate per request independent of volume, no writes, fields, counters or new collections', async () => {
    const collections = async () =>
      (await connection.db!.listCollections({}, { nameOnly: true }).toArray())
        .map((row) => row.name)
        .sort();
    await fixture();
    const initialCollections = await collections();
    const before = JSON.stringify(await payments.find().lean());
    const spy = vi.spyOn(payments, 'aggregate');
    await get().expect(200);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(await payments.find().lean())).toBe(before);
    for (let i = 0; i < 25; i++) await fixture();
    const all = JSON.stringify(await payments.find().lean());
    await get().expect(200);
    expect(spy).toHaveBeenCalledTimes(2);
    await get().expect(200);
    expect(spy).toHaveBeenCalledTimes(3);
    expect(JSON.stringify(await payments.find().lean())).toBe(all);
    expect(await collections()).toEqual(initialCollections);
  });
  it('exposes aggregate-only response and Swagger schema without private transaction or booking details', async () => {
    const row = await fixture();
    const response = await get().expect(200);
    expect(JSON.stringify(response.body)).not.toContain(row.transactionRef);
    expect(JSON.stringify(response.body)).not.toContain(String(row.booking));
    const { body } = await http().get('/api/docs-json').expect(200);
    expect(
      body.paths[base].get.responses['200'].content['application/json'].schema
        .$ref,
    ).toContain('RevenueReport');
  });
  it('rejects unauthenticated access', async () => {
    await http().get(base).query(period).expect(401);
  });
  it.each(['CUSTOMER', 'RECEPTIONIST', 'SERVICE_STAFF', 'OPERATIONS_STAFF'])(
    'rejects role %s',
    async (role) => {
      const user = await users.create({
        email: `uc56-${role}@example.test`,
        fullName: role,
        role,
      });
      userIds.push(user._id);
      await http()
        .get(base)
        .set(headers(role, user._id))
        .query(period)
        .expect(403);
    },
  );
  it.each([
    {},
    { from: period.from },
    { from: '2026-10-03', to: '2026-10-01' },
    { from: '2026-02-30', to: '2026-03-01' },
    { from: '01/10/2026', to: period.to },
    { from: '2024-01-01', to: '2025-01-01' },
    { ...period, method: 'CARD' },
    { ...period, purpose: 'REFUND' },
    { ...period, granularity: 'year' },
    { ...period, extra: 'x' },
  ])('rejects invalid query %j with standard error', async (query) => {
    const { body } = await get(query).expect(400);
    expect(body).toMatchObject({
      statusCode: 400,
      path: expect.stringContaining(base),
      timestamp: expect.any(String),
      error: expect.any(String),
    });
  });
  it.each(['post', 'put', 'patch', 'delete'] as const)(
    'has no %s write endpoint',
    async (method) => {
      await http()[method](base).set(headers()).send({}).expect(404);
    },
  );
});
