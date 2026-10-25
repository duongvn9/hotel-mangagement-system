import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { Model } from 'mongoose';
import { Role } from '../../common/constants/role.enum.js';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { PaymentTransaction } from '../payments/schemas/payment-transaction.schema.js';
import { RevenueReportQuery } from './dto/revenue-report.dto.js';
import { reportBuckets, reportPeriod } from './report-period.js';
import {
  RevenueReportClock,
  RevenueReportService,
} from './revenue-report.service.js';
const actor: AuthUser = {
  id: 'manager',
  email: 'manager@example.test',
  role: Role.Manager,
};
const query = () =>
  Object.assign(new RevenueReportQuery(), {
    from: '2026-10-01',
    to: '2026-10-03',
  });
describe('UC56 revenue reporting core', () => {
  it('uses inclusive Vietnam days and leap years', () => {
    expect(reportPeriod('2026-10-01', '2026-10-01')).toEqual({
      start: new Date('2026-09-30T17:00:00Z'),
      end: new Date('2026-10-01T17:00:00Z'),
      days: 1,
    });
    expect(reportPeriod('2024-01-01', '2024-12-31').days).toBe(366);
    expect(reportBuckets('2026-01-31', '2026-03-01', 'month')).toEqual([
      '2026-01',
      '2026-02',
      '2026-03',
    ]);
  });
  it.each([
    ['2026-02-30', '2026-03-01'],
    ['2026-1-01', '2026-01-02'],
    ['2026-02-02', '2026-02-01'],
    ['2024-01-01', '2025-01-01'],
  ])('rejects invalid period %s / %s', (from, to) =>
    expect(() => reportPeriod(from, to)).toThrow(),
  );
  it.each([
    { from: '2026-10-01' },
    { from: '2026-10-01', to: '2026-10-03', method: 'CARD' },
    { from: '2026-10-01', to: '2026-10-03', purpose: 'REFUND' },
    { from: '2026-10-01', to: '2026-10-03', granularity: 'year' },
    { from: '2026-10-01', to: '2026-10-03', other: 'x' },
  ])('rejects invalid query %j', (input) => {
    expect(
      validateSync(plainToInstance(RevenueReportQuery, input), {
        whitelist: true,
        forbidNonWhitelisted: true,
      }).length,
    ).toBeGreaterThan(0);
  });
  it('aggregates freshly once per request, fills gaps and never promises refund zero', async () => {
    const exec = vi.fn().mockResolvedValue({});
    exec.mockResolvedValue([
      {
        successes: [
          {
            _id: { method: 'CASH', purpose: 'FINAL', bucket: '2026-10-02' },
            count: 2,
            amount: 1234567890123,
          },
        ],
        unsuccessful: [{ _id: 'FAILED', count: 1 }],
        anomalies: [{ count: 2 }],
      },
    ]);
    const aggregate = vi.fn(() => ({ exec }));
    const clock = { now: vi.fn(() => new Date('2026-10-25T00:00:00Z')) };
    const service = new RevenueReportService(
      { aggregate } as unknown as Model<PaymentTransaction>,
      clock,
    );
    const first = await service.revenue(query(), actor);
    await service.revenue(query(), actor);
    expect(aggregate).toHaveBeenCalledTimes(2);
    expect(clock.now).toHaveBeenCalledTimes(2);
    expect(first.totals).toMatchObject({
      successCount: 2,
      successAmount: 1234567890123,
      refunds: null,
      refundsSupported: false,
      netAmount: null,
      failedCount: 1,
      anomalies: { count: 2 },
    });
    expect(first.series.map((row) => row.successAmount)).toEqual([
      0, 1234567890123, 0,
    ]);
    expect(first.byMethod.map((row) => row.successAmount)).toEqual([
      0, 1234567890123,
    ]);
    expect(first.byPurpose.map((row) => row.successAmount)).toEqual([
      0, 1234567890123,
    ]);
  });
  it('rejects unsafe total instead of silently rounding money', async () => {
    const aggregate = () => ({
      exec: async () => [
        {
          anomalies: [],
          unsuccessful: [],
          successes: [
            {
              _id: { method: 'CASH', purpose: 'FINAL', bucket: '2026-10-01' },
              count: 2,
              amount: Number.MAX_SAFE_INTEGER + 1,
            },
          ],
        },
      ],
    });
    const service = new RevenueReportService(
      { aggregate } as unknown as Model<PaymentTransaction>,
      new RevenueReportClock(),
    );
    await expect(service.revenue(query(), actor)).rejects.toThrow(
      'giới hạn số nguyên',
    );
  });
  it('rejects non-Manager before any database query', async () => {
    const aggregate = vi.fn();
    const service = new RevenueReportService(
      { aggregate } as unknown as Model<PaymentTransaction>,
      new RevenueReportClock(),
    );
    await expect(
      service.revenue(query(), { ...actor, role: Role.Customer }),
    ).rejects.toThrow();
    expect(aggregate).not.toHaveBeenCalled();
  });
});
