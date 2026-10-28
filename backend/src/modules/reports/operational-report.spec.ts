import {
  OperationalReportClock,
  OperationalReportService,
} from './operational-report.service.js';
import { Role } from '../../common/constants/role.enum.js';
import type { TaskSupervisionService } from '../task-supervision/task-supervision.service.js';
describe('UC57 absent sources and access', () => {
  const actor = {
    id: '507f1f77bcf86cd799439011',
    email: 'manager@example.test',
    role: Role.Manager,
    permissions: [],
  };
  const service = () =>
    new OperationalReportService(
      { summary: vi.fn() } as unknown as TaskSupervisionService,
      new OperationalReportClock(),
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
    );
  it('marks absent sources unavailable without inventing counts', async () => {
    const d = await service().operational(
      { from: '2026-10-01', to: '2026-10-02', granularity: 'day' },
      actor,
    );
    for (const key of [
      'bookings',
      'occupancy',
      'roomsSnapshot',
      'serviceOrders',
      'issues',
      'maintenance',
      'tasks',
    ] as const)
      expect(d[key]).toEqual({ available: false, reason: 'not_available' });
    expect(d.hasPeriodData).toBe(false);
    expect(d.series).toHaveLength(2);
    expect(d.series[0].serviceOrdersCreated).toBe(0);
  });
  it('rejects non-manager directly before reading any sources', async () => {
    await expect(
      service().operational(
        { from: '2026-10-01', to: '2026-10-02', granularity: 'day' },
        { ...actor, role: Role.Customer },
      ),
    ).rejects.toThrow('Manager');
  });
});
