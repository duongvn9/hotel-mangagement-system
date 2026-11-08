import { Model } from 'mongoose';
import { Role } from '../../common/constants/role.enum.js';
import { Booking } from '../bookings/schemas/booking.schema.js';
import { Feedback } from '../feedback/schemas/feedback.schema.js';
import { RevenueReportService } from '../reports/revenue-report.service.js';
import { DashboardInsightsService } from './dashboard-insights.service.js';

const actor = {
  id: 'manager',
  email: 'manager@example.test',
  role: Role.Manager,
};
function setup() {
  const aggregate = vi.fn().mockReturnValue({
    exec: vi.fn().mockResolvedValue([{ count: 2, average: 4.5 }]),
  });
  const exec = vi.fn().mockResolvedValue([]);
  const find = vi.fn().mockReturnValue({
    sort: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    populate: vi.fn().mockReturnThis(),
    lean: vi.fn().mockReturnThis(),
    exec,
  });
  const countDocuments = vi.fn().mockResolvedValue(7);
  const bookings = { find, countDocuments };
  const feedback = { aggregate };
  const revenue = {
    revenue: vi.fn().mockImplementation(async (q) => ({
      period: q,
      totals: { successAmount: 100 },
      series: [{ bucket: q.from, successAmount: 100 }],
    })),
  };
  const service = new DashboardInsightsService(
    bookings as unknown as Model<Booking>,
    feedback as unknown as Model<Feedback>,
    revenue as unknown as RevenueReportService,
  );
  return { service, bookings, feedback, revenue, exec };
}
describe('Manager dashboard prototype insights', () => {
  it('uses two adjacent inclusive 14-day Vietnam periods and handles an unchanged total', async () => {
    const { service, revenue } = setup();
    const result = await service.revenueSummary(
      actor,
      new Date('2026-11-06T17:01:00Z'),
    );
    expect(revenue.revenue.mock.calls.map(([q]) => [q.from, q.to])).toEqual([
      ['2026-10-25', '2026-11-07'],
      ['2026-10-11', '2026-10-24'],
    ]);
    expect(result).toMatchObject({
      available: true,
      amount: 100,
      changePercent: 0,
      series: [{ day: '2026-10-25', revenue: 100 }],
    });
  });
  it('does not invent percentage growth when the previous period is zero', async () => {
    const { service, revenue } = setup();
    revenue.revenue
      .mockResolvedValueOnce({ totals: { successAmount: 100 }, series: [] })
      .mockResolvedValueOnce({ totals: { successAmount: 0 }, series: [] });
    expect(
      await service.revenueSummary(actor, new Date('2026-11-07T00:00:00Z')),
    ).toMatchObject({ changePercent: null });
  });
  it('counts only active confirmed/checked-in bookings and orders the latest six by creation time', async () => {
    const { service, bookings } = setup();
    const result = await service.bookingSummary();
    expect(bookings.countDocuments).toHaveBeenCalledWith({
      isActive: true,
      status: { $in: ['CONFIRMED', 'CHECKED_IN'] },
    });
    expect(bookings.find().sort).toHaveBeenCalledWith({
      createdAt: -1,
      _id: -1,
    });
    expect(bookings.find().limit).toHaveBeenCalledWith(6);
    expect(result).toEqual({ available: true, activeCount: 7, recent: [] });
  });
  it('averages only active valid ratings and represents an empty set as null', async () => {
    const { service, feedback } = setup();
    expect(await service.feedbackSummary()).toEqual({
      available: true,
      count: 2,
      average: 4.5,
    });
    expect(feedback.aggregate).toHaveBeenCalledWith([
      { $match: { isActive: true, rating: { $in: [1, 2, 3, 4, 5] } } },
      {
        $group: { _id: null, count: { $sum: 1 }, average: { $avg: '$rating' } },
      },
    ]);
    vi.mocked(feedback.aggregate).mockReturnValue({
      exec: vi.fn().mockResolvedValue([]),
    });
    expect(await service.feedbackSummary()).toEqual({
      available: true,
      count: 0,
      average: null,
    });
  });
});
