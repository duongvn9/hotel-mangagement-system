import { BookingStatus } from '../../common/constants/booking-status.enum.js';
import { businessBoundary } from './availability.core.js';
import { bookingAttentionQueries } from './booking-attention.core.js';

describe('bookingAttentionQueries', () => {
  // 12:00 ngày 10/11/2026 giờ Việt Nam.
  const now = new Date('2026-11-10T05:00:00.000Z');
  const startToday = businessBoundary(now);
  const startTomorrow = new Date(startToday.getTime() + 86_400_000);

  it('anchors the day window on the Vietnam business day of now', () => {
    expect(startToday.toISOString()).toBe('2026-11-09T17:00:00.000Z');
    expect(startTomorrow.toISOString()).toBe('2026-11-10T17:00:00.000Z');
  });

  it('flags checked-in bookings whose checkout date already passed', () => {
    expect(bookingAttentionQueries(now).overdueCheckOut).toEqual({
      status: BookingStatus.CheckedIn,
      isActive: true,
      checkOut: { $lt: startToday },
    });
  });

  it('flags confirmed bookings whose check-in date already passed', () => {
    expect(bookingAttentionQueries(now).overdueCheckIn).toEqual({
      status: BookingStatus.Confirmed,
      isActive: true,
      checkIn: { $lt: startToday },
    });
  });

  it('flags checkouts and check-ins due today within the business day window', () => {
    const queries = bookingAttentionQueries(now);
    expect(queries.dueCheckOut).toEqual({
      status: BookingStatus.CheckedIn,
      isActive: true,
      checkOut: { $gte: startToday, $lt: startTomorrow },
    });
    expect(queries.dueCheckIn).toEqual({
      status: BookingStatus.Confirmed,
      isActive: true,
      checkIn: { $gte: startToday, $lt: startTomorrow },
    });
  });
});
