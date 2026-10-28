import { Logger } from '@nestjs/common';
import type { Model } from 'mongoose';
import { ServiceOrderReviewStatus } from '../service-orders/service-order-status.js';
import { IssueStatus } from '../issues/schemas/issue.schema.js';
import type { FrontDeskService } from '../bookings/front-desk.service.js';
import type { RoomStatusBoardService } from '../bookings/room-status-board.service.js';
import { ReceptionDashboardService } from './reception-dashboard.service.js';
import { DashboardClock } from './dashboard.service.js';

const frontDesk = {
  date: '2026-10-28',
  summary: {
    arrivals: { total: 3, awaitingDeposit: 1, ready: 1, checkedIn: 1 },
    departures: { total: 2, awaitingCheckOut: 1, checkedOut: 1 },
  },
  arrivals: [{ guestName: 'Khách Riêng Tư', guestPhone: '0900000000' }],
  departures: [{ guestName: 'Khách Khác', guestEmail: 'secret@example.test' }],
};
const board = {
  date: '2026-10-28',
  summary: {
    total: 10,
    free: 4,
    held: 1,
    reserved: 2,
    inHouse: 2,
    maintenance: 1,
    cleaning: 1,
  },
  rooms: [{ roomNumber: '101', booking: { guestName: 'Khách Riêng Tư' } }],
};

function setup(overrides: { now?: Date } = {}) {
  const sameDay = vi.fn().mockResolvedValue(frontDesk);
  const boardFn = vi.fn().mockResolvedValue(board);
  const serviceOrders = { countDocuments: vi.fn().mockResolvedValue(5) };
  const issues = { countDocuments: vi.fn().mockResolvedValue(2) };
  const feedback = { countDocuments: vi.fn().mockResolvedValue(7) };
  const clock = new DashboardClock();
  vi.spyOn(clock, 'now').mockReturnValue(
    overrides.now ?? new Date('2026-10-28T03:00:00Z'),
  );
  const service = new ReceptionDashboardService(
    { sameDay } as unknown as FrontDeskService,
    { board: boardFn } as unknown as RoomStatusBoardService,
    serviceOrders as unknown as Model<unknown>,
    issues as unknown as Model<unknown>,
    feedback as unknown as Model<unknown>,
    clock,
  );
  return { service, sameDay, boardFn, serviceOrders, issues, feedback };
}

afterEach(() => vi.restoreAllMocks());

describe('Reception dashboard orchestration', () => {
  it('projects only summaries and counts, never guest or room details', async () => {
    const { service, sameDay, boardFn } = setup();
    const data = await service.reception();

    expect(sameDay).toHaveBeenCalledWith({});
    expect(boardFn).toHaveBeenCalledWith({});
    expect(data.generatedAt).toBe('2026-10-28T03:00:00.000Z');
    expect(data.frontDesk).toEqual({
      available: true,
      date: '2026-10-28',
      arrivals: frontDesk.summary.arrivals,
      departures: frontDesk.summary.departures,
    });
    expect(data.rooms).toEqual({
      available: true,
      date: '2026-10-28',
      ...board.summary,
    });
    const text = JSON.stringify(data);
    expect(text).not.toContain('Riêng Tư');
    expect(text).not.toContain('secret@example.test');
    expect(text).not.toContain('roomNumber');
  });

  it('counts the requests that wait for the receptionist', async () => {
    const { service, serviceOrders, issues, feedback } = setup();
    const data = await service.reception();

    expect(serviceOrders.countDocuments).toHaveBeenCalledWith({
      reviewStatus: ServiceOrderReviewStatus.PendingReview,
    });
    expect(issues.countDocuments).toHaveBeenCalledWith({
      status: IssueStatus.PendingReview,
    });
    expect(feedback.countDocuments).toHaveBeenCalledWith({
      isActive: true,
      reply: { $exists: false },
    });
    expect(data.requests).toEqual({
      available: true,
      serviceOrdersPendingReview: 5,
      issuesPendingReview: 2,
      feedbackUnreplied: 7,
    });
  });

  it('keeps the other blocks when one source fails and logs without private data', async () => {
    const { service, sameDay } = setup();
    sameDay.mockRejectedValue(new Error('boom: Khách Riêng Tư'));
    const error = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => {});

    const data = await service.reception();

    expect(data.frontDesk).toEqual({ available: false, reason: 'error' });
    expect(data.rooms).toMatchObject({ available: true, total: 10 });
    expect(data.requests).toMatchObject({ available: true });
    expect(error).toHaveBeenCalledWith({
      event: 'reception_dashboard_source_error',
      source: 'frontDesk',
      errorName: 'Error',
    });
    expect(JSON.stringify(error.mock.calls)).not.toContain('Riêng Tư');
  });

  it('marks the requests block unavailable if any of its counts fails', async () => {
    const { service, issues } = setup();
    issues.countDocuments.mockRejectedValue(new Error('db'));
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    const data = await service.reception();
    expect(data.requests).toEqual({ available: false, reason: 'error' });
    expect(data.frontDesk).toMatchObject({ available: true });
  });

  it('still answers when every source fails', async () => {
    const { service, sameDay, boardFn, serviceOrders } = setup();
    sameDay.mockRejectedValue(new Error('x'));
    boardFn.mockRejectedValue(new Error('x'));
    serviceOrders.countDocuments.mockRejectedValue(new Error('x'));
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    const data = await service.reception();
    expect(data.frontDesk).toEqual({ available: false, reason: 'error' });
    expect(data.rooms).toEqual({ available: false, reason: 'error' });
    expect(data.requests).toEqual({ available: false, reason: 'error' });
  });
});
