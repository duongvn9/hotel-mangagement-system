import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { IssuesService } from './issues.service.js';
import { IssueContextAdapter } from './issue-context.adapter.js';
import { Issue, IssuePriority, IssueStatus } from './schemas/issue.schema.js';
import { Booking } from '../bookings/schemas/booking.schema.js';
import { ListIssuesQuery } from './dto/list-issues.dto.js';
import { User } from '../users/schemas/user.schema.js';
import { TasksService } from '../tasks/tasks.service.js';

describe('Issue read service authorization', () => {
  const owner = new Types.ObjectId();
  const issueId = new Types.ObjectId();
  const bookingId = new Types.ObjectId();
  let customer: Types.ObjectId | null;
  let active: boolean;
  let exists: boolean;
  const issue = {
    _id: issueId,
    title: 'Lamp',
    category: 'Lighting',
    description: 'Broken',
    priority: IssuePriority.Normal,
    status: IssueStatus.PendingReview,
    reportedAt: new Date(),
    closedAt: new Date(),
    booking: bookingId,
    reporter: owner,
  };
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
  const accessible = () => exists && active && customer?.equals(owner);
  const bookings = {
    find: vi.fn(() => query(accessible() ? [{ _id: bookingId }] : [])),
  };
  const issues = {
    find: vi.fn(() => query(accessible() ? [issue] : [])),
    countDocuments: vi.fn(async () => (accessible() ? 1 : 0)),
    findOne: vi.fn(() => query(accessible() ? issue : null)),
  };
  const service = new IssuesService(
    issues as unknown as Model<Issue>,
    {} as IssueContextAdapter,
    bookings as unknown as Model<Booking>,
    {} as Model<User>,
    {} as TasksService,
  );
  const actor = {
    id: String(owner),
    email: 'same@example.test',
    role: 'CUSTOMER',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    customer = owner;
    issue.reporter = owner;
    active = true;
    exists = true;
  });

  it('reads by current booking ownership even when reporter differs', async () => {
    issue.reporter = new Types.ObjectId();
    const result = await service.findOne(String(issueId), actor);
    expect(result.closedAt).toBe(issue.closedAt.toISOString());
    expect(result).not.toHaveProperty('reporter');
    expect(bookings.find).toHaveBeenCalledWith({
      customer: owner,
      isActive: true,
    });
  });

  it.each(['reassigned', 'null', 'missing', 'inactive'])(
    'revokes list and detail when booking is %s despite reporter matching',
    async (reason) => {
      await service.findOne(String(issueId), actor);
      if (reason === 'reassigned') customer = new Types.ObjectId();
      if (reason === 'null') customer = null;
      if (reason === 'missing') exists = false;
      if (reason === 'inactive') active = false;
      await expect(service.findOne(String(issueId), actor)).rejects.toThrow(
        'Issue not found',
      );
      expect(await service.list(new ListIssuesQuery(), actor)).toEqual({
        items: [],
        total: 0,
        page: 1,
        limit: 20,
      });
      expect(issues.find).toHaveBeenLastCalledWith({ booking: { $in: [] } });
      expect(issues.findOne).toHaveBeenLastCalledWith({
        _id: issueId,
        booking: { $in: [] },
      });
    },
  );

  it.each([
    'SERVICE_STAFF',
    'OPERATIONS_STAFF',
    'CUSTOM_MANAGER',
    'manager',
    '',
  ])('rechecks denied role %s in service', async (role) => {
    await expect(
      service.list(new ListIssuesQuery(), { ...actor, role }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.findOne('bad', { ...actor, role }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(bookings.find).not.toHaveBeenCalled();
    expect(issues.findOne).not.toHaveBeenCalled();
  });

  it('rejects an invalid authenticated identity before querying', async () => {
    await expect(
      service.list(new ListIssuesQuery(), { ...actor, id: 'bad' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(bookings.find).not.toHaveBeenCalled();
  });
});
