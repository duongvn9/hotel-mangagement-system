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

describe('Report issue HTTP', () => {
  let app: INestApplication;
  const owner = new Types.ObjectId();
  const booking = new Types.ObjectId();
  const room = new Types.ObjectId();
  const resolve = vi.fn();
  const create = vi.fn();
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
        { provide: getModelToken(Issue.name), useValue: { create } },
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
    create.mockImplementation(async (value: object) => ({
      _id: new Types.ObjectId(),
      ...value,
    }));
  });
  afterAll(async () => {
    await app.close();
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
