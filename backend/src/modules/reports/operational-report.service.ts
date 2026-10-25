import {
  ForbiddenException,
  Injectable,
  Logger,
  Optional,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, type PipelineStage } from 'mongoose';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { Role } from '../../common/constants/role.enum.js';
import { RoomStatus } from '../../common/constants/room-status.enum.js';
import { BUSINESS_TIMEZONE } from '../../common/database/conventions.js';
import { Booking, BookingStatus } from '../bookings/schemas/booking.schema.js';
import { businessBoundary } from '../bookings/availability.core.js';
import { Room } from '../rooms/schemas/room.schema.js';
import { ServiceOrder } from '../service-orders/schemas/service-order.schema.js';
import {
  ServiceOrderReviewStatus,
  ServiceOrderExecutionStatus,
} from '../service-orders/service-order-status.js';
import { Issue, IssueStatus } from '../issues/schemas/issue.schema.js';
import { Maintenance } from '../maintenance/schemas/maintenance.schema.js';
import {
  maintenanceTaskLookup,
  maintenanceStatusStage,
} from '../maintenance/maintenance-history.pipeline.js';
import { Task, TaskStatus } from '../tasks/schemas/task.schema.js';
import { TaskSupervisionService } from '../task-supervision/task-supervision.service.js';
import { reportBuckets, reportPeriod } from './report-period.js';
import {
  OperationalReportQuery,
  type OperationalReport,
  type OperationalBucket,
  type OperationalUnavailable,
  type OperationalRooms,
} from './dto/operational-report.dto.js';
type Group = { _id?: string | null; count?: number; avg?: number | null };
type Facets = Record<string, Group[]>;
type Metric = Exclude<keyof OperationalBucket, 'bucket'>;
type Events = Partial<Record<Metric, Group[]>>;
type Context = {
  query: OperationalReportQuery;
  range: { $gte: Date; $lt: Date };
  start: Date;
  end: Date;
  now: string;
  days: number;
};
const unavailable = (): OperationalUnavailable => ({
  available: false,
  reason: 'not_available',
});
const sum = (rows: Group[] | undefined) =>
  (rows ?? []).reduce((total, row) => total + (row.count ?? 0), 0);
const average = (rows: Group[] | undefined) =>
  rows?.[0]?.avg == null ? null : Math.round(rows[0].avg * 10) / 10;
const distribution = (values: readonly string[], rows: Group[] | undefined) => {
  const counts = new Map(values.map((value) => [value, 0]));
  for (const row of rows ?? [])
    counts.set(row._id ?? 'Không xác định', row.count ?? 0);
  return Object.fromEntries(counts);
};
@Injectable()
export class OperationalReportClock {
  now() {
    return new Date();
  }
}
@Injectable()
export class OperationalReportService {
  private readonly logger = new Logger(OperationalReportService.name);
  constructor(
    private readonly supervision: TaskSupervisionService,
    private readonly clock: OperationalReportClock,
    @Optional()
    @InjectModel(Booking.name)
    private readonly bookings: Model<Booking> | undefined,
    @Optional()
    @InjectModel(Room.name)
    private readonly rooms: Model<Room> | undefined,
    @Optional()
    @InjectModel(ServiceOrder.name)
    private readonly orders: Model<ServiceOrder> | undefined,
    @Optional()
    @InjectModel(Issue.name)
    private readonly issues: Model<Issue> | undefined,
    @Optional()
    @InjectModel(Maintenance.name)
    private readonly maintenance: Model<Maintenance> | undefined,
    @Optional()
    @InjectModel(Task.name)
    private readonly tasks: Model<Task> | undefined,
  ) {}
  private async facets<T>(
    model: Model<T> | undefined,
    facets: Record<string, PipelineStage.FacetPipelineStage[]>,
    initial: PipelineStage[] = [],
  ): Promise<Facets | null> {
    if (!model) return null;
    const [result] = await model
      .aggregate<Facets>([...initial, { $facet: facets }])
      .exec();
    return result ?? {};
  }
  private match(field: string, c: Context): PipelineStage.Match {
    return { $match: { [field]: c.range } };
  }
  private event(field: string, c: Context): PipelineStage.FacetPipelineStage[] {
    return [
      this.match(field, c),
      {
        $group: {
          _id: {
            $dateToString: {
              date: `$${field}`,
              format: c.query.granularity === 'month' ? '%Y-%m' : '%Y-%m-%d',
              timezone: BUSINESS_TIMEZONE,
            },
          },
          count: { $sum: 1 },
        },
      },
    ];
  }
  private groups(field: string): PipelineStage.Group {
    return { $group: { _id: `$${field}`, count: { $sum: 1 } } };
  }
  private duration(
    start: string,
    end: string,
    c: Context,
  ): PipelineStage.FacetPipelineStage[] {
    return [
      this.match(end, c),
      {
        $match: {
          $expr: {
            $and: [
              { $eq: [{ $type: `$${start}` }, 'date'] },
              { $gte: [`$${end}`, `$${start}`] },
            ],
          },
        },
      },
      {
        $group: {
          _id: null,
          avg: {
            $avg: {
              $divide: [{ $subtract: [`$${end}`, `$${start}`] }, 3600000],
            },
          },
        },
      },
    ];
  }
  async bookingPart(c: Context) {
    const r = await this.facets(
      this.bookings,
      {
        created: this.event('createdAt', c),
        checkedIn: this.event('checkedInAt', c),
        checkedOut: this.event('checkedOutAt', c),
        cancelled: this.event('cancelledAt', c),
        occupied: [
          {
            $match: {
              status: {
                $in: [BookingStatus.CheckedIn, BookingStatus.CheckedOut],
              },
            },
          },
          {
            $set: {
              stayStart: {
                $dateTrunc: {
                  date: '$checkIn',
                  unit: 'day',
                  timezone: BUSINESS_TIMEZONE,
                },
              },
              stayEnd: {
                $dateTrunc: {
                  date: '$checkOut',
                  unit: 'day',
                  timezone: BUSINESS_TIMEZONE,
                },
              },
            },
          },
          {
            $match: {
              $expr: {
                $and: [
                  { $lt: ['$stayStart', c.end] },
                  { $gt: ['$stayEnd', c.start] },
                ],
              },
            },
          },
          {
            $group: {
              _id: null,
              count: {
                $sum: {
                  $multiply: [
                    {
                      $dateDiff: {
                        startDate: { $max: ['$stayStart', c.start] },
                        endDate: { $min: ['$stayEnd', c.end] },
                        unit: 'day',
                        timezone: BUSINESS_TIMEZONE,
                      },
                    },
                    { $size: '$rooms' },
                  ],
                },
              },
            },
          },
        ],
      },
      [{ $match: { isActive: true } }],
    );
    if (!r)
      return { data: unavailable(), occupied: null, events: {} as Events };
    return {
      data: {
        available: true as const,
        created: sum(r.created),
        checkedIn: sum(r.checkedIn),
        checkedOut: sum(r.checkedOut),
        cancelled: sum(r.cancelled),
      },
      occupied: sum(r.occupied),
      events: { bookingsCreated: r.created, checkIns: r.checkedIn } as Events,
    };
  }
  async roomPart(
    c: Context,
  ): Promise<OperationalRooms | OperationalUnavailable> {
    const r = await this.facets(
      this.rooms,
      { states: [this.groups('status')] },
      [{ $match: { isActive: true } }],
    );
    if (!r) return unavailable();
    if (
      (r.states ?? []).some(
        (row) => !Object.values(RoomStatus).includes(row._id as RoomStatus),
      )
    )
      throw new Error('Invalid room status in operational report');
    return {
      available: true,
      asOf: c.now,
      activeTotal: sum(r.states),
      byStatus: distribution(
        Object.values(RoomStatus),
        r.states,
      ) as unknown as OperationalRooms['byStatus'],
    };
  }
  async serviceOrderPart(c: Context) {
    const r = await this.facets(this.orders, {
      created: this.event('requestedTime', c),
      review: [this.match('requestedTime', c), this.groups('reviewStatus')],
      execution: [
        this.match('requestedTime', c),
        this.groups('executionStatus'),
      ],
    });
    if (!r) return { data: unavailable(), events: {} as Events };
    return {
      data: {
        available: true as const,
        created: sum(r.created),
        byReviewStatus: distribution(
          Object.values(ServiceOrderReviewStatus),
          r.review,
        ),
        byExecutionStatus: distribution(
          Object.values(ServiceOrderExecutionStatus),
          r.execution,
        ),
      },
      events: { serviceOrdersCreated: r.created } as Events,
    };
  }
  async issuePart(c: Context) {
    const r = await this.facets(this.issues, {
      reported: this.event('reportedAt', c),
      closed: this.event('closedAt', c),
      states: [this.match('reportedAt', c), this.groups('status')],
      categories: [
        this.match('reportedAt', c),
        this.groups('category'),
        { $sort: { _id: 1 } },
      ],
      average: this.duration('reportedAt', 'closedAt', c),
    });
    if (!r) return { data: unavailable(), events: {} as Events };
    return {
      data: {
        available: true as const,
        reported: sum(r.reported),
        closed: sum(r.closed),
        byStatus: distribution(Object.values(IssueStatus), r.states),
        byCategory: (r.categories ?? []).map((row) => ({
          category: row._id ?? 'Không xác định',
          count: row.count ?? 0,
        })),
        avgResolutionHours: average(r.average),
      },
      events: { issuesReported: r.reported } as Events,
    };
  }
  async maintenancePart(c: Context) {
    if (!this.maintenance || !this.tasks)
      return { data: unavailable(), events: {} as Events };
    const r = (await this.facets(
      this.maintenance,
      {
        reported: [{ $count: 'count' }],
        prevents: [{ $match: { preventsSafeUse: true } }, { $count: 'count' }],
        requires: [{ $match: { requiresAction: true } }, { $count: 'count' }],
        states: [this.groups('historyStatus')],
        series: this.event('createdAt', c),
      },
      [
        this.match('createdAt', c),
        ...maintenanceTaskLookup(this.tasks.collection.name),
        maintenanceStatusStage(),
      ],
    ))!;
    const unknown = sum((r.states ?? []).filter((row) => row._id === null));
    if (unknown)
      this.logger.warn({
        event: 'operational_maintenance_unknown_status',
        count: unknown,
      });
    const states = distribution(
      [...Object.values(TaskStatus), 'NO_ACTION'],
      (r.states ?? []).filter((row) => row._id !== null),
    );
    return {
      data: {
        available: true as const,
        reported: sum(r.reported),
        preventsSafeUse: sum(r.prevents),
        requiresAction: sum(r.requires),
        byStatus: states as unknown as {
          ASSIGNED: number;
          IN_PROGRESS: number;
          COMPLETED: number;
          NO_ACTION: number;
        },
        unknownStatus: unknown,
      },
      events: { maintenanceReported: r.series } as Events,
    };
  }
  async taskPart(c: Context, actor: AuthUser) {
    if (!this.tasks) return { data: unavailable(), events: {} as Events };
    const [r, snapshot] = await Promise.all([
      this.facets(this.tasks, {
        assigned: this.event('assignedAt', c),
        completed: this.event('completedAt', c),
        types: [
          this.match('assignedAt', c),
          this.groups('taskType'),
          { $sort: { _id: 1 } },
        ],
        sources: [
          this.match('assignedAt', c),
          this.groups('sourceType'),
          { $sort: { _id: 1 } },
        ],
        average: this.duration('assignedAt', 'completedAt', c),
      }),
      this.supervision.summary({}, actor),
    ]);
    return {
      data: {
        available: true as const,
        period: {
          assigned: sum(r?.assigned),
          completed: sum(r?.completed),
          byTaskType: (r?.types ?? []).map((row) => ({
            taskType: row._id ?? 'Không xác định',
            count: row.count ?? 0,
          })),
          bySourceType: (r?.sources ?? []).map((row) => ({
            sourceType: row._id ?? 'Không xác định',
            count: row.count ?? 0,
          })),
          avgCompletionHours: average(r?.average),
        },
        snapshot: {
          asOf: c.now,
          assigned: snapshot.counts.assigned,
          inProgress: snapshot.counts.inProgress,
          overdue: snapshot.overdue,
        },
      },
      events: { tasksCompleted: r?.completed ?? [] } as Events,
    };
  }
  async operational(
    query: OperationalReportQuery,
    actor: AuthUser,
  ): Promise<OperationalReport> {
    if (actor.role !== Role.Manager)
      throw new ForbiddenException('Chỉ Manager được xem báo cáo vận hành');
    const range = reportPeriod(query.from, query.to);
    const c: Context = {
      query,
      start: businessBoundary(range.start),
      end: businessBoundary(range.end),
      range: { $gte: range.start, $lt: range.end },
      days: range.days,
      now: this.clock.now().toISOString(),
    };
    const [b, rooms, s, i, m, t] = await Promise.all([
      this.bookingPart(c),
      this.roomPart(c),
      this.serviceOrderPart(c),
      this.issuePart(c),
      this.maintenancePart(c),
      this.taskPart(c, actor),
    ]);
    const occupancy =
      b.occupied !== null && rooms.available
        ? {
            available: true as const,
            occupiedRoomNights: b.occupied,
            availableRoomNights: rooms.activeTotal * c.days,
            rate: rooms.activeTotal
              ? Math.round(
                  (b.occupied / (rooms.activeTotal * c.days)) * 10000,
                ) / 10000
              : null,
            note: 'Ước tính: mẫu số dùng số phòng đang hoạt động tại thời điểm xem; không có lịch sử số phòng/trạng thái. Tỷ lệ có thể vượt 100%.',
          }
        : unavailable();
    const series = reportBuckets(query.from, query.to, query.granularity).map(
      (bucket) => ({
        bucket,
        bookingsCreated: 0,
        checkIns: 0,
        serviceOrdersCreated: 0,
        issuesReported: 0,
        maintenanceReported: 0,
        tasksCompleted: 0,
      }),
    );
    const index = new Map(series.map((row) => [row.bucket, row]));
    for (const part of [b, s, i, m, t])
      for (const [metric, groups] of Object.entries(part.events) as [
        Metric,
        Group[],
      ][])
        for (const group of groups) {
          const bucket = index.get(group._id ?? '');
          if (bucket) bucket[metric] += group.count ?? 0;
        }
    const hasPeriodData = [
      b.data.available
        ? b.data.created +
          b.data.checkedIn +
          b.data.checkedOut +
          b.data.cancelled
        : 0,
      b.occupied ?? 0,
      s.data.available ? s.data.created : 0,
      i.data.available ? i.data.reported + i.data.closed : 0,
      m.data.available ? m.data.reported : 0,
      t.data.available ? t.data.period.assigned + t.data.period.completed : 0,
    ].some((count) => count > 0);
    return {
      period: {
        from: query.from,
        to: query.to,
        timezone: BUSINESS_TIMEZONE,
        granularity: query.granularity,
        days: c.days,
      },
      generatedAt: c.now,
      hasPeriodData,
      bookings: b.data,
      occupancy,
      roomsSnapshot: rooms,
      serviceOrders: s.data,
      issues: i.data,
      maintenance: m.data,
      tasks: t.data,
      series,
    };
  }
}
