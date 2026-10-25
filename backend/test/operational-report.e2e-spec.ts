import { randomUUID } from 'node:crypto';
import { VersioningType, type INestApplication } from '@nestjs/common';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Connection, type Model, Types } from 'mongoose';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import {
  OperationalReportClock,
  OperationalReportService,
} from '../src/modules/reports/operational-report.service.js';
import { TaskSupervisionService } from '../src/modules/task-supervision/task-supervision.service.js';
import { Role } from '../src/common/constants/role.enum.js';
import { assertTestDatabase } from './test-database.js';
import { ID_TOKEN_VERIFIER } from '../src/modules/auth/firebase.module.js';
import { SYSTEM_ROLES } from '../src/modules/roles/seed.js';

describe('UC57 real operational aggregation', () => {
  let app: INestApplication, connection: Connection, manager: Types.ObjectId;
  const original = process.env.MONGODB_URI;
  const owned = new Map<string, Types.ObjectId[]>();
  const base = '/api/v1/reports/operational';
  const period = { from: '2026-10-01', to: '2026-10-03' };
  const now = new Date('2026-10-25T03:00:00Z');
  const day = (date: string) => new Date(`${date}T00:00:00+07:00`);
  const model = (name: string): Model<any> => app.get(getModelToken(name));
  const headers = (role = 'MANAGER') => ({
    'x-dev-role': role,
    'x-dev-user-id': String(manager),
  });
  const http = () => request(app.getHttpServer());
  const get = (query: object = period) =>
    http().get(base).set(headers()).query(query);
  async function fixture(name: string, extra: Record<string, unknown>) {
    const row = await model(name).create(extra);
    owned.set(name, [...(owned.get(name) ?? []), row._id]);
    return row;
  }
  async function booking(extra: Record<string, unknown> = {}) {
    return fixture('Booking', {
      code: randomUUID(),
      guestName: 'Private guest',
      guestEmail: 'private@example.test',
      guestPhone: '0900000000',
      rooms: [new Types.ObjectId()],
      checkIn: day('2026-10-01'),
      checkOut: day('2026-10-04'),
      guests: 1,
      roomTotal: 100,
      depositAmount: 10,
      status: 'CHECKED_IN',
      createdAt: day('2026-10-01'),
      ...extra,
    });
  }
  async function task(extra: Record<string, unknown> = {}) {
    return fixture('Task', {
      title: 'Private task',
      taskType: 'Unusual type',
      priority: 'free priority',
      assignedTo: manager,
      assignedAt: day('2026-10-01'),
      dueAt: day('2026-10-02'),
      sourceType: 'ISSUE',
      sourceId: new Types.ObjectId(),
      status: 'ASSIGNED',
      ...extra,
    });
  }
  async function room(status = 'AVAILABLE', isActive = true) {
    return fixture('Room', {
      roomNumber: randomUUID(),
      floor: 1,
      roomType: new Types.ObjectId(),
      status,
      isActive,
    });
  }
  async function cleanup() {
    for (const [name, ids] of owned)
      if (name !== 'User') {
        await model(name).deleteMany({ _id: { $in: ids } });
        owned.delete(name);
      }
  }
  beforeAll(async () => {
    assertTestDatabase(original);
    const uri = new URL(original!);
    uri.pathname = `/hms_uc57_${randomUUID().replaceAll('-', '')}_test`;
    process.env.MONGODB_URI = uri.toString();
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(OperationalReportClock)
      .useValue({ now: () => new Date(now) })
      .overrideProvider(ID_TOKEN_VERIFIER)
      .useValue({
        verifyIdToken: async () => ({
          uid: 'uc57-custom',
          email_verified: true,
          email: 'uc57-custom@example.test',
        }),
      })
      .compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    SwaggerModule.setup(
      'api/docs',
      app,
      SwaggerModule.createDocument(
        app,
        new DocumentBuilder().setTitle('UC57').build(),
      ),
    );
    await app.init();
    connection = app.get(getConnectionToken());
    await Promise.all(Object.values(connection.models).map((m) => m.init()));
    manager = (
      await fixture('User', {
        email: 'uc57@example.test',
        fullName: 'Manager',
        role: 'MANAGER',
      })
    )._id;
  }, 60000);
  beforeEach(cleanup);
  afterEach(() => vi.restoreAllMocks());
  afterAll(async () => {
    await cleanup();
    if (app)
      await model('User').deleteMany({ _id: { $in: owned.get('User') ?? [] } });
    await app?.close();
    if (original === undefined) delete process.env.MONGODB_URI;
    else process.env.MONGODB_URI = original;
  });
  it('uses each event timestamp and reconciles every continuous series', async () => {
    await booking({
      createdAt: day('2026-09-01'),
      checkedInAt: day('2026-10-01'),
      checkedOutAt: day('2026-10-03'),
      cancelledAt: day('2026-10-02'),
    });
    await booking({ createdAt: day('2026-10-02'), isActive: false });
    await fixture('ServiceOrder', {
      customer: manager,
      booking: new Types.ObjectId(),
      service: new Types.ObjectId(),
      serviceName: 'Private service',
      quantity: 1,
      unitPriceVND: 10,
      amount: 10,
      requestedTime: day('2026-10-02'),
      createdAt: day('2026-09-01'),
    });
    await fixture('Issue', {
      title: 'Private issue',
      description: 'Private',
      category: 'New category',
      reporter: manager,
      booking: new Types.ObjectId(),
      reportedAt: day('2026-09-30'),
      closedAt: day('2026-10-01'),
      status: 'CLOSED',
    });
    await task({
      assignedAt: day('2026-09-30'),
      completedAt: day('2026-10-02'),
      status: 'COMPLETED',
    });
    const { body: d } = await get().expect(200);
    expect(d.bookings).toMatchObject({
      created: 0,
      checkedIn: 1,
      checkedOut: 1,
      cancelled: 1,
    });
    expect(d.serviceOrders.created).toBe(1);
    expect(d.issues).toMatchObject({
      reported: 0,
      closed: 1,
      avgResolutionHours: 24,
    });
    expect(d.tasks.period).toMatchObject({
      assigned: 0,
      completed: 1,
      avgCompletionHours: 48,
    });
    expect(d.series.map((r: any) => r.bucket)).toEqual([
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
    ]);
    for (const [key, count] of Object.entries({
      bookingsCreated: 0,
      checkIns: 1,
      serviceOrdersCreated: 1,
      issuesReported: 0,
      maintenanceReported: 0,
      tasksCompleted: 1,
    }))
      expect(d.series.reduce((sum: number, r: any) => sum + r[key], 0)).toBe(
        count,
      );
    expect(JSON.stringify(d)).not.toMatch(
      /Private|private@example|0900000000|assignedTo|guestName/,
    );
  });
  it.each([
    ['2026-10-01', '2026-10-04', 3],
    ['2026-09-30', '2026-10-03', 2],
    ['2026-10-02', '2026-10-05', 2],
    ['2026-09-01', '2026-11-01', 3],
    ['2026-09-01', '2026-09-30', 0],
    ['2026-09-30', '2026-10-01', 0],
    ['2026-10-04', '2026-10-05', 0],
  ])(
    'intersects H6 calendar stay %s–%s with period (%i nights per room)',
    async (start, end, nights) => {
      await room();
      await booking({
        checkIn: day(start),
        checkOut: day(end),
        rooms: [new Types.ObjectId(), new Types.ObjectId()],
      });
      const { body: d } = await get().expect(200);
      expect(d.occupancy).toMatchObject({
        occupiedRoomNights: nights * 2,
        availableRoomNights: 3,
        rate: Math.round(((nights * 2) / 3) * 10000) / 10000,
      });
    },
  );
  it('excludes unstayed/inactive bookings, normalizes UTC instants by Vietnam day, and returns null with no active rooms', async () => {
    for (const status of ['CONFIRMED', 'PENDING_DEPOSIT', 'CANCELLED'])
      await booking({ status });
    await booking({ isActive: false });
    await room('AVAILABLE', false);
    expect((await get()).body.occupancy).toMatchObject({
      occupiedRoomNights: 0,
      availableRoomNights: 0,
      rate: null,
    });
    await booking({
      status: 'CHECKED_OUT',
      checkIn: new Date('2026-09-30T18:00:00Z'),
      checkOut: new Date('2026-10-02T16:00:00Z'),
    });
    expect((await get()).body.occupancy.occupiedRoomNights).toBe(1);
  });
  it('uses Vietnam inclusive boundaries and partial monthly buckets', async () => {
    for (const createdAt of [
      '2026-09-30T16:59:59.999Z',
      '2026-09-30T17:00:00Z',
      '2026-10-03T16:59:59.999Z',
      '2026-10-03T17:00:00Z',
    ])
      await booking({ createdAt: new Date(createdAt), status: 'CONFIRMED' });
    expect(
      (await get()).body.series.map((r: any) => r.bookingsCreated),
    ).toEqual([1, 0, 1]);
    const d = (
      await get({ from: '2026-09-30', to: '2026-10-01', granularity: 'month' })
    ).body;
    expect(d.series.map((r: any) => [r.bucket, r.bookingsCreated])).toEqual([
      ['2026-09', 1],
      ['2026-10', 1],
    ]);
  });
  it('keeps snapshots independent of period and reuses UC55 counts', async () => {
    for (const status of ['AVAILABLE', 'OCCUPIED', 'CLEANING', 'MAINTENANCE'])
      await room(status);
    await room('AVAILABLE', false);
    await task();
    await task({ status: 'IN_PROGRESS' });
    const a = (await get()).body,
      b = (await get({ from: '2025-01-01', to: '2025-01-01' })).body;
    const summary = await app
      .get(TaskSupervisionService)
      .summary(
        {},
        { id: String(manager), role: Role.Manager, email: 'uc57@example.test' },
      );
    expect(a.roomsSnapshot).toEqual(b.roomsSnapshot);
    expect(a.roomsSnapshot.byStatus).toEqual({
      AVAILABLE: 1,
      OCCUPIED: 1,
      CLEANING: 1,
      MAINTENANCE: 1,
    });
    expect(a.tasks.snapshot).toEqual(b.tasks.snapshot);
    expect(a.tasks.snapshot).toMatchObject({
      assigned: summary.counts.assigned,
      inProgress: summary.counts.inProgress,
      overdue: summary.overdue,
    });
    expect(b.hasPeriodData).toBe(false);
    expect(a.tasks.period.byTaskType).toEqual([
      { taskType: 'Unusual type', count: 2 },
    ]);
  });
  it('reuses UC36 maintenance state including no-action and missing/corrupt links', async () => {
    for (const state of [
      'ASSIGNED',
      'IN_PROGRESS',
      'COMPLETED',
      'NO_ACTION',
      'MISSING',
      'CORRUPT',
    ]) {
      const m = await fixture('Maintenance', {
        reportedBy: manager,
        facilityLocation: 'Lobby',
        description: 'Private maintenance',
        requiresAction: state !== 'NO_ACTION',
        preventsSafeUse: true,
        requestKey: randomUUID(),
        requestFingerprint: 'fixture',
        createdAt: day('2026-10-02'),
      });
      if (!['NO_ACTION', 'MISSING'].includes(state)) {
        const t = await task({
          sourceType: 'MAINTENANCE',
          sourceId: state === 'CORRUPT' ? new Types.ObjectId() : m._id,
          status: state === 'CORRUPT' ? 'ASSIGNED' : state,
        });
        await model('Maintenance').updateOne(
          { _id: m._id },
          { $set: { task: t._id } },
        );
      }
    }
    const d = (await get()).body;
    expect(d.maintenance).toMatchObject({
      reported: 6,
      preventsSafeUse: 6,
      requiresAction: 5,
      byStatus: { ASSIGNED: 1, IN_PROGRESS: 1, COMPLETED: 1, NO_ACTION: 1 },
      unknownStatus: 2,
    });
  });
  it('recomputes without writes, caches or N+1; failure returns standard 500', async () => {
    const b = await booking({ status: 'CONFIRMED' });
    const sourceModels = [
      'Booking',
      'Room',
      'ServiceOrder',
      'Issue',
      'Maintenance',
      'Task',
    ];
    const before = await model('Booking').findById(b._id).lean();
    const spies = sourceModels.map((name) =>
      vi.spyOn(model(name), 'aggregate'),
    );
    expect((await get()).body.bookings.created).toBe(1);
    expect(spies.map((s) => s.mock.calls.length)).toEqual([1, 1, 1, 1, 1, 2]);
    await get();
    expect(await model('Booking').findById(b._id).lean()).toEqual(before);
    await booking({ status: 'CONFIRMED' });
    expect((await get()).body.bookings.created).toBe(2);
    vi.spyOn(app.get(OperationalReportService), 'issuePart').mockRejectedValue(
      new Error('private source failure'),
    );
    const { body } = await get().expect(500);
    expect(body).toMatchObject({
      statusCode: 500,
      path: expect.stringContaining(base),
    });
    expect(JSON.stringify(body)).not.toContain('private source failure');
  });
  it('exposes Swagger and only a read endpoint', async () => {
    const { body } = await http().get('/api/docs-json').expect(200);
    expect(body.paths[base].get).toBeDefined();
    expect(
      body.components.schemas.OperationalReport.properties.occupancy.oneOf,
    ).toHaveLength(2);
    for (const method of ['post', 'put', 'patch', 'delete'] as const)
      await http()[method](base).set(headers()).expect(404);
  });
  it('allows Manager only, even when other roles have report:view', async () => {
    await http().get(base).query(period).expect(401);
    for (const role of [
      'CUSTOMER',
      'RECEPTIONIST',
      'SERVICE_STAFF',
      'OPERATIONS_STAFF',
    ])
      await http().get(base).set(headers(role)).query(period).expect(403);
    await get().expect(200);
  });
  it('rejects an authenticated custom role that actually has report:view', async () => {
    await fixture('Role', {
      code: 'UC57_CUSTOM',
      name: 'Custom reporter',
      permissions: ['report:view'],
    });
    await fixture('User', {
      email: 'uc57-custom@example.test',
      firebaseUid: 'uc57-custom',
      emailVerified: true,
      fullName: 'Custom reporter',
      role: 'UC57_CUSTOM',
    });
    await http()
      .get(base)
      .set('Authorization', 'Bearer fixture-token')
      .query(period)
      .expect(403);
    expect(
      SYSTEM_ROLES.filter((role) =>
        role.permissions.includes('report:view'),
      ).map((role) => role.code),
    ).toEqual([Role.Manager]);
  });
  it.each([
    {},
    { from: '2026-10-01' },
    { to: '2026-10-03' },
    { from: '2026-02-30', to: '2026-03-01' },
    { from: '01/10/2026', to: '2026-10-03' },
    { from: '2026-10-04', to: '2026-10-01' },
    { ...period, granularity: 'year' },
    { ...period, method: 'CASH' },
    { from: '2024-01-01', to: '2025-01-01' },
  ])('rejects invalid query %j', async (query) => {
    await get(query).expect(400);
  });
  it('accepts 366 days and emits empty buckets while retaining snapshots', async () => {
    const d = (await get({ from: '2024-01-01', to: '2024-12-31' }).expect(200))
      .body;
    expect(d.series).toHaveLength(366);
    expect(d.hasPeriodData).toBe(false);
    expect(d.roomsSnapshot.available).toBe(true);
  });
  it('does not require current closed/completed status for event counts and excludes invalid durations', async () => {
    for (const [start, end] of [
      ['2026-09-30', '2026-10-01'],
      ['2026-10-02', '2026-10-01'],
    ] as const) {
      await fixture('Issue', {
        title: 'Fixture',
        description: 'Fixture',
        category: 'Free category',
        reporter: manager,
        booking: new Types.ObjectId(),
        reportedAt: day(start),
        closedAt: day(end),
        status: 'REVIEWED',
      });
      await task({
        assignedAt: day(start),
        completedAt: day(end),
        status: 'ASSIGNED',
      });
    }
    const d = (await get()).body;
    expect(d.issues).toMatchObject({ closed: 2, avgResolutionHours: 24 });
    expect(d.tasks.period).toMatchObject({
      completed: 2,
      avgCompletionHours: 24,
    });
  });
  it('treats an ongoing stay as period data even without events in the period', async () => {
    await booking({
      createdAt: day('2026-09-01'),
      checkIn: day('2026-09-30'),
      checkOut: day('2026-10-10'),
    });
    const d = (await get()).body;
    expect(d.bookings.created).toBe(0);
    expect(d.hasPeriodData).toBe(true);
    expect(d.occupancy.occupiedRoomNights).toBe(3);
  });
});
