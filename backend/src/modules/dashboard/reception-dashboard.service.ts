import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { FrontDeskService } from '../bookings/front-desk.service.js';
import { RoomStatusBoardService } from '../bookings/room-status-board.service.js';
import { Feedback } from '../feedback/schemas/feedback.schema.js';
import { Issue, IssueStatus } from '../issues/schemas/issue.schema.js';
import { ServiceOrder } from '../service-orders/schemas/service-order.schema.js';
import { ServiceOrderReviewStatus } from '../service-orders/service-order-status.js';
import { DashboardClock } from './dashboard.service.js';
import type { UnavailableDashboardBlock } from './dto/manager-dashboard.dto.js';
import type {
  ReceptionDashboard,
  ReceptionFrontDesk,
  ReceptionRequests,
  ReceptionRooms,
} from './dto/reception-dashboard.dto.js';

@Injectable()
export class ReceptionDashboardService {
  private readonly logger = new Logger(ReceptionDashboardService.name);

  constructor(
    private readonly frontDesk: FrontDeskService,
    private readonly roomBoard: RoomStatusBoardService,
    @InjectModel(ServiceOrder.name)
    private readonly serviceOrders: Model<ServiceOrder>,
    @InjectModel(Issue.name) private readonly issues: Model<Issue>,
    @InjectModel(Feedback.name) private readonly feedback: Model<Feedback>,
    private readonly clock: DashboardClock,
  ) {}

  /** Một nguồn lỗi chỉ làm khối đó không khả dụng; log không kèm dữ liệu khách. */
  private result<T>(
    source: string,
    result: PromiseSettledResult<T>,
  ): T | UnavailableDashboardBlock {
    if (result.status === 'fulfilled') return result.value;
    this.logger.error({
      event: 'reception_dashboard_source_error',
      source,
      errorName:
        result.reason instanceof Error ? result.reason.name : 'UnknownError',
    });
    return { available: false, reason: 'error' };
  }

  private async frontDeskSummary(): Promise<ReceptionFrontDesk> {
    const data = await this.frontDesk.sameDay({});
    return {
      available: true,
      date: data.date,
      arrivals: data.summary.arrivals,
      departures: data.summary.departures,
    };
  }

  private async roomsSummary(): Promise<ReceptionRooms> {
    const data = await this.roomBoard.board({});
    return { available: true, date: data.date, ...data.summary };
  }

  private async requestsSummary(): Promise<ReceptionRequests> {
    const [serviceOrders, issues, feedback] = await Promise.all([
      this.serviceOrders.countDocuments({
        reviewStatus: ServiceOrderReviewStatus.PendingReview,
      }),
      this.issues.countDocuments({ status: IssueStatus.PendingReview }),
      this.feedback.countDocuments({
        isActive: true,
        reply: { $exists: false },
      }),
    ]);
    return {
      available: true,
      serviceOrdersPendingReview: serviceOrders,
      issuesPendingReview: issues,
      feedbackUnreplied: feedback,
    };
  }

  /** Tổng quan cho lễ tân: đến/đi và phòng của hôm nay, cùng các việc đang chờ lễ tân xử lý. */
  async reception(): Promise<ReceptionDashboard> {
    const [frontDesk, rooms, requests] = await Promise.allSettled([
      this.frontDeskSummary(),
      this.roomsSummary(),
      this.requestsSummary(),
    ] as const);
    return {
      generatedAt: this.clock.now().toISOString(),
      frontDesk: this.result('frontDesk', frontDesk),
      rooms: this.result('rooms', rooms),
      requests: this.result('requests', requests),
    };
  }
}
