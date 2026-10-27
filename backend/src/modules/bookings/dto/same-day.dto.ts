import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, Matches } from 'class-validator';
import type { BookingListItem } from './list-bookings.dto.js';

export class SameDayQuery {
  @ApiPropertyOptional({
    description: 'Ngày xem (YYYY-MM-DD, giờ Việt Nam), mặc định hôm nay',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be YYYY-MM-DD' })
  date?: string;
}

export class SameDaySummary {
  arrivals: {
    total: number;
    /** Booking PENDING_DEPOSIT: khách đến nhưng chưa đặt cọc. */
    awaitingDeposit: number;
    /** Booking CONFIRMED: sẵn sàng nhận phòng. */
    ready: number;
    checkedIn: number;
  };
  departures: {
    total: number;
    /** Booking CHECKED_IN: đang ở, chờ trả phòng. */
    awaitingCheckOut: number;
    checkedOut: number;
  };
}

export class SameDayResponse {
  date: string;
  summary: SameDaySummary;
  arrivals: BookingListItem[];
  departures: BookingListItem[];
}
