import {
  ValidationPipe,
  VersioningType,
  type INestApplication,
} from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { Types } from 'mongoose';
import request from 'supertest';
import { AuthGuard } from '../auth/auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { ID_TOKEN_VERIFIER } from '../auth/firebase.module.js';
import { User } from '../users/schemas/user.schema.js';
import { Role } from '../roles/schemas/role.schema.js';
import { IssueContextAdapter } from './issue-context.adapter.js';
import { IssuesController } from './issues.controller.js';
import { IssuesService } from './issues.service.js';
import { Issue } from './schemas/issue.schema.js';
import { Booking } from '../bookings/schemas/booking.schema.js';

describe('Report issue HTTP', () => {
  let app: INestApplication;
  const owner = new Types.ObjectId();
  const booking = new Types.ObjectId();
  const room = new Types.ObjectId();
  const resolve = vi.fn();
  const create = vi.fn();
  const find = vi.fn();
  const findOne = vi.fn();
  const countDocuments = vi.fn();
  const findBookings = vi.fn();
  const issueId = new Types.ObjectId();
  const readIssue = {
    _id: issueId,
    title: 'Broken lamp',
    category: 'Lighting',
    description: 'No light',
    priority: 'NORMAL',
    status: 'PENDING_REVIEW',
    reportedAt: new Date('2026-10-01'),
    booking,
    room,
    reporter: owner,
    guestEmail: 'private@example.test',
  };
  const chain = (value: unknown) => {
    const query = {
      select: vi.fn(),
      sort: vi.fn(),
      skip: vi.fn(),
      limit: vi.fn(),
      lean: vi.fn().mockResolvedValue(value),
    };
    for (const method of ['select', 'sort', 'skip', 'limit'] as const)
      query[method].mockReturnValue(query);
    return query;
  };
  const payload = {
    title: '  Broken lamp  ',
    category: ' Lighting ',
    description: ' Lamp does not work ',
    bookingId: String(booking),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [IssuesController],
      providers: [
        IssuesService,
        { provide: getModelToken(Role.name), useValue: {} },
        { provide: IssueContextAdapter, useValue: { resolve } },
        {
          provide: getModelToken(Issue.name),
          useValue: { create, find, findOne, countDocuments },
        },
        {
          provide: getModelToken(Booking.name),
          useValue: { find: findBookings },
        },
        {
          provide: getModelToken(User.name),
          useValue: {
            findOne: vi
              .fn()
              .mockImplementation(
                ({ firebaseUid }: { firebaseUid: string }) => ({
                  lean: async () => ({
                    _id: owner,
                    email: 'reporter@example.test',
                    role: firebaseUid,
                    isActive: true,
                    emailVerified: true,
                  }),
                }),
              ),
          },
        },
        {
          provide: ID_TOKEN_VERIFIER,
          useValue: {
            verifyIdToken: async (token: string) => ({
              uid: token,
              email_verified: true,
            }),
          },
        },
        { provide: APP_GUARD, useClass: AuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
      ],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    resolve.mockResolvedValue({ booking });
    findBookings.mockReturnValue(chain([{ _id: booking }]));
    find.mockReturnValue(chain([readIssue]));
    findOne.mockReturnValue(chain(readIssue));
    countDocuments.mockResolvedValue(1);
    create.mockImplementation(async (value: object) => ({
      _id: new Types.ObjectId(),
      ...value,
    }));
  });
  afterAll(async () => {
    await app.close();
  });

  const get = (path = '', role = 'CUSTOMER') =>
    request(app.getHttpServer())
      .get(`/api/v1/issues${path}`)
      .set('Authorization', `Bearer ${role}`);

  it('reads a scoped page with safe projection and defaults', async () => {
    const response = await get().expect(200);
    expect(response.body).toEqual({
      items: [
        {
          id: String(issueId),
          title: 'Broken lamp',
          category: 'Lighting',
          description: 'No light',
          priority: 'NORMAL',
          status: 'PENDING_REVIEW',
          reportedAt: '2026-10-01T00:00:00.000Z',
          bookingId: String(booking),
          roomId: String(room),
        },
      ],
      total: 1,
      page: 1,
      limit: 20,
    });
    expect(findBookings).toHaveBeenCalledWith({
      customer: owner,
      isActive: true,
    });
    expect(find).toHaveBeenCalledWith({ booking: { $in: [booking] } });
    expect(countDocuments).toHaveBeenCalledWith({
      booking: { $in: [booking] },
    });
  });

  it.each(['RECEPTIONIST', 'MANAGER'])(
    'allows exact operational role %s without customer scoping',
    async (role) => {
      await get('', role).expect(200);
      await get(`/${issueId}`, role).expect(200);
      expect(findBookings).not.toHaveBeenCalled();
      expect(find).toHaveBeenCalledWith({});
    },
  );

  it.each(['SERVICE_STAFF', 'OPERATIONS_STAFF', 'CUSTOM_READER', 'manager'])(
    'denies read role %s',
    async (role) => {
      await get('', role).expect(403);
      await get(`/${issueId}`, role).expect(403);
      expect(find).not.toHaveBeenCalled();
      expect(findOne).not.toHaveBeenCalled();
    },
  );

  it('requires auth for both reads', async () => {
    await request(app.getHttpServer()).get('/api/v1/issues').expect(401);
    await request(app.getHttpServer())
      .get(`/api/v1/issues/${issueId}`)
      .expect(401);
  });

  it('returns detail with task expansion explicitly unavailable', async () => {
    const response = await get(`/${issueId}`).expect(200);
    expect(response.body).toMatchObject({
      id: String(issueId),
      linkedTasks: [],
      linkedTasksAvailable: false,
    });
    expect(response.body.reporter).toBeUndefined();
    expect(response.body.guestEmail).toBeUndefined();
    expect(findOne).toHaveBeenCalledWith({
      _id: issueId,
      booking: { $in: [booking] },
    });
  });

  it('uses identical missing, inaccessible and malformed detail responses', async () => {
    findOne.mockReturnValue(chain(null));
    const absent = await get(`/${new Types.ObjectId()}`).expect(404);
    const foreign = await get(`/${issueId}`).expect(404);
    const malformed = await get('/not-an-id').expect(404);
    expect(absent.body).toEqual(foreign.body);
    expect(absent.body).toEqual(malformed.body);
  });

  it('filters exact category and enums and escapes literal title search', async () => {
    await get(
      '?status=PENDING_REVIEW&priority=NORMAL&category=Lighting&keyword=%5Ba%5D.*&page=2&limit=3',
    ).expect(200);
    expect(find).toHaveBeenCalledWith({
      booking: { $in: [booking] },
      status: 'PENDING_REVIEW',
      priority: 'NORMAL',
      category: 'Lighting',
      title: { $regex: '\\[a\\]\\.\\*', $options: 'i' },
    });
    const query = find.mock.results[0].value;
    expect(query.skip).toHaveBeenCalledWith(3);
    expect(query.limit).toHaveBeenCalledWith(3);
    expect(query.sort).toHaveBeenCalledWith({ reportedAt: -1, _id: -1 });
  });

  it.each([
    'page=0',
    'page=10001',
    'page=1.5',
    'page=1e2',
    'page=-1',
    'page=',
    'page=1&page=2',
    'limit=0',
    'limit=101',
    'limit=abc',
    'status=CLOSED',
    'priority=HIGH',
    'category=',
    'keyword=',
    'keyword=a&keyword=b',
    'reporter=x',
    'category[$ne]=x',
  ])('rejects query %s', async (query) => {
    await get(`?${query}`).expect(400);
    expect(find).not.toHaveBeenCalled();
  });

  it('returns an empty page when no issues match', async () => {
    findBookings.mockReturnValue(chain([]));
    find.mockReturnValue(chain([]));
    countDocuments.mockResolvedValue(0);
    const response = await get('?page=10000&limit=100').expect(200);
    expect(response.body).toEqual({
      items: [],
      total: 0,
      page: 10000,
      limit: 100,
    });
    expect(find).toHaveBeenCalledWith({ booking: { $in: [] } });
  });

  const post = (body: object, role = 'CUSTOMER') =>
    request(app.getHttpServer())
      .post('/api/v1/issues')
      .set('Authorization', `Bearer ${role}`)
      .send(body);

  it('requires authentication', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/issues')
      .send(payload)
      .expect(401);
    expect(create).not.toHaveBeenCalled();
  });

  it.each(['RECEPTIONIST', 'MANAGER', 'SERVICE_STAFF', 'OPERATIONS_STAFF'])(
    'forbids %s',
    async (role) => {
      await post(payload, role).expect(403);
      expect(create).not.toHaveBeenCalled();
    },
  );

  it('trims inputs, derives reporter and returns only the public response', async () => {
    const response = await post(payload).expect(201);
    expect(resolve).toHaveBeenCalledWith(
      String(owner),
      String(booking),
      undefined,
    );
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        reporter: owner,
        booking,
        title: 'Broken lamp',
        priority: 'NORMAL',
        status: 'PENDING_REVIEW',
      }),
    );
    expect(response.body).toEqual({
      id: expect.any(String),
      title: 'Broken lamp',
      category: 'Lighting',
      description: 'Lamp does not work',
      priority: 'NORMAL',
      status: 'PENDING_REVIEW',
      reportedAt: expect.any(String),
      bookingId: String(booking),
    });
  });

  it('supports room context', async () => {
    resolve.mockResolvedValue({ booking, room });
    const response = await post({ ...payload, roomId: String(room) }).expect(
      201,
    );
    expect(response.body.roomId).toBe(String(room));
  });

  it.each([
    'reporter',
    'reporterId',
    'priority',
    'status',
    'closedAt',
    'serviceOrderId',
    'taskId',
  ])('rejects extra field %s', async (field) => {
    await post({ ...payload, [field]: String(owner) }).expect(400);
    expect(create).not.toHaveBeenCalled();
  });

  it.each([
    { bookingId: undefined },
    { bookingId: 'bad' },
    { roomId: null },
    { roomId: '' },
    { roomId: 'bad' },
    { title: '   ' },
    { category: '\n ' },
    { description: '' },
    { title: 12 },
    { title: 'a'.repeat(201) },
    { category: 'a'.repeat(101) },
    { description: 'a'.repeat(5001) },
  ])('rejects invalid input %j', async (change) => {
    await post({ ...payload, ...change }).expect(400);
    expect(resolve).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });
});
