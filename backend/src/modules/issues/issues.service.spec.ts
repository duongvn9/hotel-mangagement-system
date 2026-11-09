import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { randomUUID } from 'node:crypto';
import { IssuesService } from './issues.service.js';
import { IssueContextAdapter } from './issue-context.adapter.js';
import { Issue } from './schemas/issue.schema.js';
import { Booking } from '../bookings/schemas/booking.schema.js';
import { ListIssuesQuery } from './dto/list-issues.dto.js';
import { User } from '../users/schemas/user.schema.js';
import { TasksService } from '../tasks/tasks.service.js';

const query = (result: unknown) => {
  const chain = {
    select: vi.fn(),
    sort: vi.fn(),
    skip: vi.fn(),
    limit: vi.fn(),
    lean: async () => result,
  };
  for (const key of ['select', 'sort', 'skip', 'limit'] as const)
    chain[key].mockReturnValue(chain);
  return chain;
};

describe('Customer issue reporting', () => {
  const owner = new Types.ObjectId();
  const booking = new Types.ObjectId();
  const actor = {
    id: String(owner),
    email: 'owner@example.test',
    role: 'CUSTOMER',
  };
  const dto = () => ({
    title: 'Lamp',
    category: 'Lighting',
    description: 'Broken',
    bookingId: String(booking),
    requestId: randomUUID(),
  });
  const resolve = vi.fn();
  const records: (Issue & { _id: Types.ObjectId })[] = [];
  const issues = {
    findOne: vi.fn((key: { requestId: string }) =>
      query(records.find((entry) => entry.requestId === key.requestId) ?? null),
    ),
    create: vi.fn(async (input: Issue) => {
      if (records.some((entry) => entry.requestId === input.requestId))
        throw { code: 11000 };
      const record = { ...input, _id: new Types.ObjectId() };
      records.push(record);
      return record;
    }),
  };
  const service = new IssuesService(
    issues as unknown as Model<Issue>,
    { resolve } as unknown as IssueContextAdapter,
    {} as Model<Booking>,
    {} as Model<User>,
    {} as TasksService,
  );
  beforeEach(() => {
    vi.clearAllMocks();
    records.length = 0;
    resolve.mockResolvedValue({ booking });
  });
  it('deduplicates concurrent requests using the persisted fingerprint', async () => {
    const input = dto();
    const results = await Promise.all([
      service.create(input, actor.id),
      service.create(input, actor.id),
    ]);
    expect(results[0]).toEqual(results[1]);
    expect(records).toHaveLength(1);
    expect(records[0].requestFingerprint).toMatch(/^customer:/);
  });
  it('replays before resolving revoked eligibility and rejects new requests', async () => {
    const input = dto();
    const original = await service.create(input, actor.id);
    resolve.mockRejectedValue(new Error('Booking not found'));
    await expect(service.create(input, actor.id)).resolves.toEqual(original);
    await expect(service.create(dto(), actor.id)).rejects.toThrow(
      'Booking not found',
    );
    expect(resolve).toHaveBeenCalledTimes(2);
  });
  it.each([
    'title',
    'category',
    'description',
    'bookingId',
    'roomId',
    'serviceOrderId',
  ])('conflicts on changed %s', async (field) => {
    const input = dto();
    await service.create(input, actor.id);
    await expect(
      service.create(
        {
          ...input,
          [field]: field.endsWith('Id')
            ? String(new Types.ObjectId())
            : 'changed',
        },
        actor.id,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });
  it('cannot replay a staff-originated record', async () => {
    const input = dto();
    await service.create(input, actor.id);
    records[0].sourceTask = new Types.ObjectId();
    await expect(service.create(input, actor.id)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
  it('requires a UUID request ID in direct service calls', async () => {
    await expect(
      service.create({ ...dto(), requestId: undefined } as never, actor.id),
    ).rejects.toThrow('Invalid input');
    expect(resolve).not.toHaveBeenCalled();
  });
});

describe('Authorized issue room display', () => {
  const owner = new Types.ObjectId();
  const booking = new Types.ObjectId();
  const room = new Types.ObjectId();
  const missing = new Types.ObjectId();
  const actor = {
    id: String(owner),
    email: 'owner@example.test',
    role: 'CUSTOMER',
  };
  const record = {
    _id: new Types.ObjectId(),
    booking,
    room,
    title: 'Lamp',
    category: 'Lighting',
    description: 'Broken',
    status: 'PENDING_REVIEW',
    priority: 'NORMAL',
    reportedAt: new Date(),
    reviewNotes: 'Internal',
    reviewedBy: new Types.ObjectId(),
    assignmentInstructions: 'Private',
    assignmentAssignee: new Types.ObjectId(),
    reassignmentHistory: [{ reason: 'Private' }],
  };
  const roomNumbers = vi.fn(async () => new Map([[String(room), '101']]));
  const issues = {
    find: vi.fn(() =>
      query([
        record,
        { ...record, room: undefined },
        { ...record, room: missing },
      ]),
    ),
    findOne: vi.fn(() => query(record)),
    countDocuments: vi.fn(async () => 3),
  };
  const bookings = { find: vi.fn(() => query([{ _id: booking }])) };
  const service = new IssuesService(
    issues as unknown as Model<Issue>,
    { roomNumbers } as unknown as IssueContextAdapter,
    bookings as unknown as Model<Booking>,
    {} as Model<User>,
    {} as TasksService,
  );
  beforeEach(() => vi.clearAllMocks());

  it('enriches only retrieved list room links in one bulk lookup with null fallbacks', async () => {
    const result = await service.list(new ListIssuesQuery(), actor);
    expect(result.items.map((item) => item.roomNumber)).toEqual([
      '101',
      null,
      null,
    ]);
    expect(result.items[0].roomId).toBe(String(room));
    expect(roomNumbers).toHaveBeenCalledExactlyOnceWith([room, missing]);
    for (const item of result.items) {
      expect(item).not.toHaveProperty('reviewNotes');
      expect(item).not.toHaveProperty('reviewedBy');
      expect(item).not.toHaveProperty('assignmentInstructions');
      expect(item).not.toHaveProperty('assigneeId');
      expect(item).not.toHaveProperty('reassignmentHistory');
    }
  });

  it('enriches authorized detail without exposing internal history or staff identities', async () => {
    const result = await service.findOne(String(record._id), actor);
    expect(result.roomNumber).toBe('101');
    expect(result.linkedTasks).toEqual([]);
    expect(result).not.toHaveProperty('resolutionTasks');
    expect(result).not.toHaveProperty('reassignmentHistory');
    expect(result).not.toHaveProperty('reviewNotes');
    expect(result).not.toHaveProperty('reviewedBy');
    expect(result).not.toHaveProperty('assigneeId');
    expect(issues.findOne).toHaveBeenCalledWith({
      _id: record._id,
      $or: [
        { reporter: owner, sourceTask: { $exists: false } },
        { booking: { $in: [booking] }, sourceTask: { $exists: true } },
      ],
    });
    expect(bookings.find).toHaveBeenCalledWith({
      customer: owner,
      isActive: true,
    });
  });

  it('returns 404 before room lookup when detail is outside either origin scope', async () => {
    issues.findOne.mockReturnValueOnce(query(null));
    await expect(
      service.findOne(String(record._id), actor),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(roomNumbers).not.toHaveBeenCalled();
  });
});

describe('Issue read authorization', () => {
  const owner = new Types.ObjectId();
  const booking = new Types.ObjectId();
  const issues = {
    find: vi.fn(() => query([])),
    countDocuments: vi.fn(async () => 0),
  };
  const bookings = { find: vi.fn(() => query([{ _id: booking }])) };
  const service = new IssuesService(
    issues as unknown as Model<Issue>,
    {} as IssueContextAdapter,
    bookings as unknown as Model<Booking>,
    {} as Model<User>,
    {} as TasksService,
  );
  const actor = {
    id: String(owner),
    email: 'owner@example.test',
    role: 'CUSTOMER',
  };
  beforeEach(() => vi.clearAllMocks());
  it('scopes self reports independently and staff reports by current active ownership', async () => {
    await service.list(new ListIssuesQuery(), actor);
    expect(issues.find).toHaveBeenCalledWith({
      $or: [
        { reporter: owner, sourceTask: { $exists: false } },
        { booking: { $in: [booking] }, sourceTask: { $exists: true } },
      ],
    });
  });
  it.each([
    'SERVICE_STAFF',
    'OPERATIONS_STAFF',
    'CUSTOM_MANAGER',
    'manager',
    '',
  ])('denies role %s', async (role) => {
    await expect(
      service.list(new ListIssuesQuery(), { ...actor, role }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(bookings.find).not.toHaveBeenCalled();
  });
  it('rejects an invalid identity', async () => {
    await expect(
      service.list(new ListIssuesQuery(), { ...actor, id: 'bad' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
