import { Logger } from '@nestjs/common';
import { Model } from 'mongoose';
import { Role } from '../../common/constants/role.enum.js';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { ROLES_KEY } from '../../common/decorators/roles.decorator.js';
import { PERMISSIONS_KEY } from '../../common/decorators/permissions.decorator.js';
import { Room } from '../rooms/schemas/room.schema.js';
import { TaskSupervisionService } from '../task-supervision/task-supervision.service.js';
import { RevenueReportService } from '../reports/revenue-report.service.js';
import { DashboardService } from './dashboard.service.js';
import { DashboardController } from './dashboard.controller.js';
const actor: AuthUser = {
  id: 'manager',
  email: 'private@example.test',
  role: Role.Manager,
};
const summary = {
  counts: { assigned: 7, inProgress: 4, completed: 3, total: 14, other: 0 },
  overdue: 2,
  workload: [{ email: 'private@example.test' }],
};
function setup(now = new Date('2026-10-31T17:00:00Z')) {
  const supervision = { summary: vi.fn().mockResolvedValue(summary) };
  const exec = vi.fn().mockResolvedValue([
    { _id: 'AVAILABLE', count: 2 },
    { _id: 'CLEANING', count: 1 },
  ]);
  const rooms = { aggregate: vi.fn(() => ({ exec })) };
  const revenue = {
    revenue: vi
      .fn()
      .mockImplementation(async (query) => ({
        period: {
          from: query.from,
          to: query.to,
          timezone: 'Asia/Ho_Chi_Minh',
        },
        totals: { successCount: 2, successAmount: 1234567 },
        private: 'secret',
      })),
  };
  const clock = { now: vi.fn(() => now) };
  const service = new DashboardService(
    supervision as unknown as TaskSupervisionService,
    rooms as unknown as Model<Room>,
    revenue as unknown as RevenueReportService,
    clock,
  );
  return { service, supervision, rooms, revenue, exec, clock };
}
afterEach(() => vi.restoreAllMocks());
describe('Manager dashboard aggregation orchestration', () => {
  it('projects only reused summaries, all four active room states and no private source data', async () => {
    const { service, supervision, rooms } = setup();
    const data = await service.manager(actor);
    expect(supervision.summary).toHaveBeenCalledWith({}, actor);
    expect(data.tasks).toEqual({
      available: true,
      counts: { assigned: 7, inProgress: 4, completed: 3 },
      overdue: 2,
    });
    expect(data.rooms).toMatchObject({
      available: true,
      activeTotal: 3,
      byStatus: { AVAILABLE: 2, OCCUPIED: 0, CLEANING: 1, MAINTENANCE: 0 },
    });
    expect(rooms.aggregate.mock.calls[0][0]).toEqual([
      { $match: { isActive: true } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
    expect(JSON.stringify(data)).not.toContain('private');
    expect(JSON.stringify(data)).not.toContain('secret');
  });
  it.each([
    ['2026-10-31T16:59:59Z', '2026-10-01', '2026-10-31'],
    ['2026-10-31T17:00:00Z', '2026-11-01', '2026-11-01'],
  ])('uses Vietnam month boundary %s', async (instant, from, to) => {
    const { service, revenue } = setup(new Date(instant));
    await service.manager(actor);
    expect(revenue.revenue).toHaveBeenCalledWith(
      expect.objectContaining({ from, to, granularity: 'day' }),
      actor,
    );
  });
  it.each(['tasks', 'rooms', 'revenue'])(
    'isolates a failing %s source, logs and hides internals',
    async (source) => {
      const setupResult = setup();
      const error = vi
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => {});
      if (source === 'tasks')
        setupResult.supervision.summary.mockRejectedValue(
          new Error('secret database URI'),
        );
      if (source === 'rooms')
        setupResult.exec.mockRejectedValue(new Error('secret database URI'));
      if (source === 'revenue')
        setupResult.revenue.revenue.mockRejectedValue(
          new Error('secret database URI'),
        );
      const data = await setupResult.service.manager(actor);
      expect(data[source as 'tasks']).toEqual({
        available: false,
        reason: 'error',
      });
      for (const name of ['tasks', 'rooms', 'revenue'] as const)
        if (name !== source) expect(data[name].available).toBe(true);
      expect(error).toHaveBeenCalledWith({
        event: 'manager_dashboard_source_error',
        source,
        errorName: 'Error',
      });
      expect(JSON.stringify(data)).not.toContain('secret');
    },
  );
  it('starts all sources before awaiting a slow source', async () => {
    const { service, supervision, rooms, revenue } = setup();
    let finish!: (value: unknown) => void;
    supervision.summary.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const pending = service.manager(actor);
    expect(rooms.aggregate).toHaveBeenCalledOnce();
    expect(revenue.revenue).toHaveBeenCalledOnce();
    finish(summary);
    await pending;
  });
  it('queries fresh on repeated requests, with one clock read per response', async () => {
    const { service, supervision, rooms, revenue, clock } = setup();
    await service.manager(actor);
    supervision.summary.mockResolvedValue({
      ...summary,
      counts: { ...summary.counts, assigned: 8 },
    });
    const second = await service.manager(actor);
    expect(second.tasks).toMatchObject({ counts: { assigned: 8 } });
    expect(supervision.summary).toHaveBeenCalledTimes(2);
    expect(rooms.aggregate).toHaveBeenCalledTimes(2);
    expect(revenue.revenue).toHaveBeenCalledTimes(2);
    expect(clock.now).toHaveBeenCalledTimes(2);
  });
  it('marks malformed legacy room status unavailable rather than showing a misleading active total', async () => {
    const { service, exec } = setup();
    exec.mockResolvedValue([{ _id: 'UNKNOWN', count: 1 }]);
    expect((await service.manager(actor)).rooms).toEqual({
      available: false,
      reason: 'error',
    });
  });
  it('enforces Manager without permission fallback before calling sources', async () => {
    const { service, supervision, rooms, revenue } = setup();
    await expect(
      service.manager({ ...actor, role: Role.Customer }),
    ).rejects.toThrow();
    expect(supervision.summary).not.toHaveBeenCalled();
    expect(rooms.aggregate).not.toHaveBeenCalled();
    expect(revenue.revenue).not.toHaveBeenCalled();
    expect(Reflect.getMetadata(ROLES_KEY, DashboardController)).toEqual([
      Role.Manager,
    ]);
    expect(
      Reflect.getMetadata(PERMISSIONS_KEY, DashboardController),
    ).toBeUndefined();
  });
  it('has no query parameters', () => {
    const controller = new DashboardController(setup().service);
    expect(() => controller.manager(actor, { from: '2026-01-01' })).toThrow(
      'không nhận',
    );
  });
});
