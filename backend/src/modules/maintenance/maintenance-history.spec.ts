import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Types } from 'mongoose';
import { Role } from '../../common/constants/role.enum.js';
import { MaintenanceHistoryQuery } from './dto/maintenance-history.dto.js';
import {
  maintenanceDateRange,
  maintenanceHistoryScope,
  MaintenanceHistoryService,
} from './maintenance-history.service.js';
import { MaintenanceSchema } from './schemas/maintenance.schema.js';

describe('UC36 query and shared scope contract', () => {
  it('defaults, transforms and rejects unknown query fields', async () => {
    const dto = plainToInstance(MaintenanceHistoryQuery, {
      page: '2',
      limit: '25',
      q: ' x.* ',
    });
    expect(await validate(dto)).toEqual([]);
    expect(dto).toMatchObject({ page: 2, limit: 25, q: 'x.*', sort: 'desc' });
    expect(
      await validate(
        plainToInstance(MaintenanceHistoryQuery, { other: true }),
        { whitelist: true, forbidNonWhitelisted: true },
      ),
    ).not.toEqual([]);
  });
  it.each([
    { page: 0 },
    { page: 1.5 },
    { limit: 1000 },
    { status: 'PENDING' },
    { sort: 'reportedAt' },
    { from: '25/10/2026' },
    { q: 'x'.repeat(101) },
    { status: null },
  ])('rejects %j', async (query) => {
    expect(
      (await validate(plainToInstance(MaintenanceHistoryQuery, query))).length,
    ).toBeGreaterThan(0);
  });
  it('maps inclusive business calendar dates to half-open UTC instants', () => {
    expect(
      maintenanceDateRange({ from: '2026-10-25', to: '2026-10-25' }),
    ).toEqual({
      $gte: new Date('2026-10-24T17:00:00Z'),
      $lt: new Date('2026-10-25T17:00:00Z'),
    });
    expect(() =>
      maintenanceDateRange({ from: '2026-10-26', to: '2026-10-25' }),
    ).toThrow();
    expect(() => maintenanceDateRange({ from: '2026-02-30' })).toThrow();
  });
  it('uses the exact same reporter-or-assignee policy and indexes', () => {
    const id = new Types.ObjectId();
    expect(maintenanceHistoryScope(id)).toEqual({
      $or: [{ reportedBy: id }, { 'taskData.assignedTo': id }],
    });
    expect(MaintenanceSchema.indexes()).toEqual(
      expect.arrayContaining([
        [{ reportedBy: 1, createdAt: -1 }, {}],
        [{ task: 1 }, {}],
      ]),
    );
  });
  it('does one aggregation per request, filters before facet and scopes both endpoints in Mongo', async () => {
    const aggregate = vi
      .fn()
      .mockReturnValue({ exec: async () => [{ items: [], count: [] }] });
    const service = new MaintenanceHistoryService(
      { aggregate } as never,
      { collection: { name: 'tasks' } } as never,
    );
    const actor = {
      id: String(new Types.ObjectId()),
      role: Role.OperationsStaff,
      email: 'not-returned@example.test',
    };
    await service.list(
      plainToInstance(MaintenanceHistoryQuery, {
        q: '[x].*',
        status: 'COMPLETED',
      }),
      actor,
    );
    const listPipeline = aggregate.mock.calls[0][0];
    expect(listPipeline).toContainEqual({
      $match: maintenanceHistoryScope(new Types.ObjectId(actor.id)),
    });
    expect(JSON.stringify(listPipeline)).toContain('\\\\');
    expect(listPipeline.at(-1)).toHaveProperty('$facet');
    aggregate.mockReturnValueOnce({ exec: async () => [] });
    await expect(
      service.detail(String(new Types.ObjectId()), actor),
    ).rejects.toMatchObject({ status: 404 });
    expect(aggregate.mock.calls[1][0]).toContainEqual({
      $match: maintenanceHistoryScope(new Types.ObjectId(actor.id)),
    });
    expect(aggregate).toHaveBeenCalledTimes(2);
    await expect(
      service.list(new MaintenanceHistoryQuery(), {
        ...actor,
        role: Role.Manager,
      }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(service.detail('bad', actor)).rejects.toMatchObject({
      status: 400,
    });
    expect(aggregate).toHaveBeenCalledTimes(2);
  });
});
