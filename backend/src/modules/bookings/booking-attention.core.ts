import { BookingStatus } from '../../common/constants/booking-status.enum.js';
import { businessBoundary } from './availability.core.js';

const MS_PER_DAY = 86_400_000;

/** Số đơn lễ tân cần chú ý, theo mốc ngày làm việc (giờ Việt Nam). */
export interface BookingAttentionCounts {
  /** CHECKED_IN đã qua ngày trả phòng (khách lố hạn, chưa check-out). */
  overdueCheckOut: number;
  /** CONFIRMED đã qua ngày nhận phòng mà chưa check-in (no-show). */
  overdueCheckIn: number;
  /** CHECKED_IN có ngày trả phòng là hôm nay (sắp tới hạn). */
  dueCheckOut: number;
  /** CONFIRMED có ngày nhận phòng là hôm nay (sắp tới hạn). */
  dueCheckIn: number;
}

type AttentionFilter = Record<string, unknown>;

/**
 * Bộ lọc đếm cho từng loại đơn cần chú ý, mốc theo ngày làm việc (giờ VN) của `now`.
 * Tách riêng khỏi service để unit-test không cần cơ sở dữ liệu.
 */
export function bookingAttentionQueries(
  now: Date,
): Record<keyof BookingAttentionCounts, AttentionFilter> {
  const startToday = businessBoundary(now);
  const startTomorrow = new Date(startToday.getTime() + MS_PER_DAY);
  const today = { $gte: startToday, $lt: startTomorrow };
  return {
    overdueCheckOut: {
      status: BookingStatus.CheckedIn,
      isActive: true,
      checkOut: { $lt: startToday },
    },
    overdueCheckIn: {
      status: BookingStatus.Confirmed,
      isActive: true,
      checkIn: { $lt: startToday },
    },
    dueCheckOut: {
      status: BookingStatus.CheckedIn,
      isActive: true,
      checkOut: today,
    },
    dueCheckIn: {
      status: BookingStatus.Confirmed,
      isActive: true,
      checkIn: today,
    },
  };
}
