import {
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { Role } from '../../common/constants/role.enum.js';
import {
  BUSINESS_TIMEZONE,
  isMoneyVnd,
} from '../../common/database/conventions.js';
import {
  PaymentMethod,
  PaymentPurpose,
  PaymentStatus,
  PaymentTransaction,
} from '../payments/schemas/payment-transaction.schema.js';
import {
  RevenueReportQuery,
  type RevenueReport,
} from './dto/revenue-report.dto.js';
import { reportBuckets, reportPeriod } from './report-period.js';

@Injectable()
export class RevenueReportClock {
  now() {
    return new Date();
  }
}
type RevenueGroup = {
  _id: { method: PaymentMethod; purpose: PaymentPurpose; bucket: string };
  count: number;
  amount: number;
};
@Injectable()
export class RevenueReportService {
  private readonly logger = new Logger(RevenueReportService.name);
  constructor(
    @InjectModel(PaymentTransaction.name)
    private readonly payments: Model<PaymentTransaction>,
    private readonly clock: RevenueReportClock,
  ) {}
  async revenue(
    query: RevenueReportQuery,
    actor: AuthUser,
  ): Promise<RevenueReport> {
    if (actor.role !== Role.Manager)
      throw new ForbiddenException('Chỉ Manager được xem báo cáo doanh thu');
    const { start, end } = reportPeriod(query.from, query.to);
    const range = { $gte: start, $lt: end };
    const methods = Object.values(PaymentMethod);
    const purposes = Object.values(PaymentPurpose);
    const validAmount = {
      $cond: [
        { $isNumber: '$amount' },
        {
          $and: [
            { $gte: ['$amount', 0] },
            { $lte: ['$amount', Number.MAX_SAFE_INTEGER] },
            { $eq: ['$amount', { $trunc: '$amount' }] },
          ],
        },
        false,
      ],
    };
    const [result] = await this.payments
      .aggregate<{
        successes: RevenueGroup[];
        anomalies: { count: number }[];
        unsuccessful: { _id: PaymentStatus; count: number }[];
      }>([
        {
          $match: {
            isActive: true,
            ...(query.method ? { method: query.method } : {}),
            ...(query.purpose ? { purpose: query.purpose } : {}),
          },
        },
        {
          $set: {
            validRevenue: {
              $and: [
                validAmount,
                { $eq: [{ $type: '$paidAt' }, 'date'] },
                { $in: ['$method', methods] },
                { $in: ['$purpose', purposes] },
              ],
            },
          },
        },
        {
          $facet: {
            successes: [
              {
                $match: {
                  status: PaymentStatus.Success,
                  validRevenue: true,
                  paidAt: range,
                },
              },
              {
                $group: {
                  _id: {
                    method: '$method',
                    purpose: '$purpose',
                    bucket: {
                      $dateToString: {
                        date: '$paidAt',
                        format:
                          query.granularity === 'month' ? '%Y-%m' : '%Y-%m-%d',
                        timezone: BUSINESS_TIMEZONE,
                      },
                    },
                  },
                  count: { $sum: 1 },
                  amount: { $sum: '$amount' },
                },
              },
            ],
            anomalies: [
              {
                $match: { status: PaymentStatus.Success, validRevenue: false },
              },
              {
                $match: {
                  $or: [
                    { paidAt: range },
                    {
                      $and: [
                        { $expr: { $ne: [{ $type: '$paidAt' }, 'date'] } },
                        { createdAt: range },
                      ],
                    },
                  ],
                },
              },
              { $count: 'count' },
            ],
            unsuccessful: [
              {
                $match: {
                  status: {
                    $in: [
                      PaymentStatus.Failed,
                      PaymentStatus.Cancelled,
                      PaymentStatus.Pending,
                    ],
                  },
                  createdAt: range,
                },
              },
              { $group: { _id: '$status', count: { $sum: 1 } } },
            ],
          },
        },
      ])
      .exec();
    const byMethod = methods.map((method) => ({
      method,
      successCount: 0,
      successAmount: 0,
    }));
    const byPurpose = purposes.map((purpose) => ({
      purpose,
      successCount: 0,
      successAmount: 0,
    }));
    const series = reportBuckets(query.from, query.to, query.granularity).map(
      (bucket) => ({ bucket, successCount: 0, successAmount: 0 }),
    );
    const totals: RevenueReport['totals'] = {
      successCount: 0,
      successAmount: 0,
      refunds: null,
      refundsSupported: false,
      netAmount: null,
      failedCount: 0,
      cancelledCount: 0,
      pendingCount: 0,
      anomalies: { count: result?.anomalies[0]?.count ?? 0 },
    };
    const add = (
      target: { successCount: number; successAmount: number },
      row: RevenueGroup,
    ) => {
      const amount = target.successAmount + row.amount;
      if (!isMoneyVnd(row.amount) || !isMoneyVnd(amount)) {
        this.logger.warn({ event: 'revenue_report_unsafe_total' });
        throw new ServiceUnavailableException(
          'Tổng tiền vượt giới hạn số nguyên an toàn; cần thu hẹp kỳ báo cáo',
        );
      }
      target.successCount += row.count;
      target.successAmount = amount;
    };
    for (const row of result?.successes ?? []) {
      add(totals, row);
      add(
        byMethod.find((item) => item.method === row._id.method)!,
        row,
      );
      add(
        byPurpose.find((item) => item.purpose === row._id.purpose)!,
        row,
      );
      add(
        series.find((item) => item.bucket === row._id.bucket)!,
        row,
      );
    }
    for (const row of result?.unsuccessful ?? []) {
      if (row._id === PaymentStatus.Failed) totals.failedCount = row.count;
      if (row._id === PaymentStatus.Cancelled)
        totals.cancelledCount = row.count;
      if (row._id === PaymentStatus.Pending) totals.pendingCount = row.count;
    }
    if (totals.anomalies.count)
      this.logger.warn({
        event: 'revenue_report_anomalies',
        count: totals.anomalies.count,
      });
    return {
      period: {
        from: query.from,
        to: query.to,
        timezone: BUSINESS_TIMEZONE,
        granularity: query.granularity,
      },
      totals,
      byMethod,
      byPurpose,
      series,
      generatedAt: this.clock.now().toISOString(),
    };
  }
}
