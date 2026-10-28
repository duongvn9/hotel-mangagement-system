import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { Role } from '../../common/constants/role.enum.js';
import { RoomStatus } from '../../common/constants/room-status.enum.js';
import { toBusinessDate } from '../../common/database/conventions.js';
import { Room } from '../rooms/schemas/room.schema.js';
import { TaskSupervisionService } from '../task-supervision/task-supervision.service.js';
import { RevenueReportService } from '../reports/revenue-report.service.js';
import { RevenueReportQuery } from '../reports/dto/revenue-report.dto.js';
import {
  type DashboardRoomCounts,
  type ManagerDashboard,
  type UnavailableDashboardBlock,
} from './dto/manager-dashboard.dto.js';
@Injectable()
export class DashboardClock {
  now() {
    return new Date();
  }
}
@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);
  constructor(
    private readonly supervision: TaskSupervisionService,
    @InjectModel(Room.name) private readonly rooms: Model<Room>,
    private readonly revenue: RevenueReportService,
    private readonly clock: DashboardClock,
  ) {}
  private result<T>(
    source: string,
    result: PromiseSettledResult<T>,
  ): T | UnavailableDashboardBlock {
    if (result.status === 'fulfilled') return result.value;
    this.logger.error({
      event: 'manager_dashboard_source_error',
      source,
      errorName:
        result.reason instanceof Error ? result.reason.name : 'UnknownError',
    });
    return { available: false, reason: 'error' };
  }
  async taskSummary(actor: AuthUser) {
    const data = await this.supervision.summary({}, actor);
    return {
      available: true as const,
      counts: {
        assigned: data.counts.assigned,
        inProgress: data.counts.inProgress,
        completed: data.counts.completed,
      },
      overdue: data.overdue,
    };
  }
  async roomSummary(now: Date) {
    const groups = await this.rooms
      .aggregate<{ _id: RoomStatus; count: number }>([
        { $match: { isActive: true } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ])
      .exec();
    const byStatus = Object.fromEntries(
      Object.values(RoomStatus).map((status) => [status, 0]),
    ) as unknown as DashboardRoomCounts;
    let activeTotal = 0;
    for (const row of groups) {
      if (!Object.hasOwn(byStatus, row._id))
        throw new Error('InvalidRoomStatus');
      byStatus[row._id] = row.count;
      activeTotal += row.count;
    }
    return {
      available: true as const,
      asOf: now.toISOString(),
      activeTotal,
      byStatus,
    };
  }
  async revenueSummary(actor: AuthUser, now: Date) {
    const to = toBusinessDate(now),
      from = `${to.slice(0, 7)}-01`;
    const query = Object.assign(new RevenueReportQuery(), {
      from,
      to,
      granularity: 'day' as const,
    });
    const data = await this.revenue.revenue(query, actor);
    return {
      available: true as const,
      period: {
        from: data.period.from,
        to: data.period.to,
        timezone: data.period.timezone,
      },
      successCount: data.totals.successCount,
      successAmount: data.totals.successAmount,
    };
  }
  async manager(actor: AuthUser): Promise<ManagerDashboard> {
    if (actor.role !== Role.Manager)
      throw new ForbiddenException('Chỉ Manager được xem Tổng quan');
    const now = this.clock.now();
    const [tasks, rooms, revenue] = await Promise.allSettled([
      this.taskSummary(actor),
      this.roomSummary(now),
      this.revenueSummary(actor, now),
    ] as const);
    return {
      generatedAt: now.toISOString(),
      tasks: this.result('tasks', tasks),
      rooms: this.result('rooms', rooms),
      revenue: this.result('revenue', revenue),
    };
  }
}
