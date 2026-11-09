import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { BookingStatus } from '../../common/constants/booking-status.enum.js';
import { toBusinessDate } from '../../common/database/conventions.js';
import { Booking } from '../bookings/schemas/booking.schema.js';
import { Feedback } from '../feedback/schemas/feedback.schema.js';
import { RevenueReportService } from '../reports/revenue-report.service.js';
import { RevenueReportQuery } from '../reports/dto/revenue-report.dto.js';
import { REPORT_DAY_MS } from '../reports/report-period.js';

@Injectable()
export class DashboardInsightsService {
  constructor(
    @InjectModel(Booking.name) private readonly bookings: Model<Booking>,
    @InjectModel(Feedback.name) private readonly feedback: Model<Feedback>,
    private readonly revenue: RevenueReportService,
  ) {}

  async revenueSummary(actor: AuthUser, now: Date) {
    const day = (offset: number) =>
      toBusinessDate(new Date(now.getTime() + offset * REPORT_DAY_MS));
    const query = (from: string, to: string) =>
      Object.assign(new RevenueReportQuery(), {
        from,
        to,
        granularity: 'day' as const,
      });
    const [current, previous] = await Promise.all([
      this.revenue.revenue(query(day(-13), day(0)), actor),
      this.revenue.revenue(query(day(-27), day(-14)), actor),
    ]);
    const amount = current.totals.successAmount;
    const previousAmount = previous.totals.successAmount;
    return {
      available: true as const,
      from: day(-13),
      to: day(0),
      amount,
      changePercent:
        previousAmount > 0
          ? ((amount - previousAmount) / previousAmount) * 100
          : null,
      series: current.series.map((row) => ({
        day: row.bucket,
        revenue: row.successAmount,
      })),
    };
  }

  async bookingSummary() {
    const [activeCount, rows] = await Promise.all([
      this.bookings.countDocuments({
        isActive: true,
        status: { $in: [BookingStatus.Confirmed, BookingStatus.CheckedIn] },
      }),
      this.bookings
        .find({ isActive: true })
        .sort({ createdAt: -1, _id: -1 })
        .limit(6)
        .select('code guestName rooms checkIn checkOut status')
        .populate<{ rooms: { _id: Types.ObjectId; roomNumber?: string }[] }>({
          path: 'rooms',
          select: 'roomNumber',
        })
        .lean()
        .exec(),
    ]);
    return {
      available: true as const,
      activeCount,
      recent: rows.map((row) => ({
        id: String(row._id),
        code: row.code,
        guestName: row.guestName ?? null,
        rooms: row.rooms.filter(Boolean).map((room) => room.roomNumber ?? '—'),
        checkIn: row.checkIn.toISOString(),
        checkOut: row.checkOut.toISOString(),
        status: row.status,
      })),
    };
  }

  async feedbackSummary() {
    const [row] = await this.feedback
      .aggregate<{ count: number; average: number }>([
        { $match: { isActive: true, rating: { $in: [1, 2, 3, 4, 5] } } },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            average: { $avg: '$rating' },
          },
        },
      ])
      .exec();
    return {
      available: true as const,
      count: row?.count ?? 0,
      average: row?.average ?? null,
    };
  }
}
