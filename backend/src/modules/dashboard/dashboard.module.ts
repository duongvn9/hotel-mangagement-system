import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BookingsModule } from '../bookings/bookings.module.js';
import {
  Feedback,
  FeedbackSchema,
} from '../feedback/schemas/feedback.schema.js';
import { Issue, IssueSchema } from '../issues/schemas/issue.schema.js';
import {
  ServiceOrder,
  ServiceOrderSchema,
} from '../service-orders/schemas/service-order.schema.js';
import { RoomsModule } from '../rooms/rooms.module.js';
import { TaskSupervisionModule } from '../task-supervision/task-supervision.module.js';
import { ReportsModule } from '../reports/reports.module.js';
import { DashboardController } from './dashboard.controller.js';
import { DashboardClock, DashboardService } from './dashboard.service.js';
import { ReceptionDashboardController } from './reception-dashboard.controller.js';
import { ReceptionDashboardService } from './reception-dashboard.service.js';
@Module({
  imports: [
    RoomsModule,
    TaskSupervisionModule,
    ReportsModule,
    BookingsModule,
    MongooseModule.forFeature([
      { name: ServiceOrder.name, schema: ServiceOrderSchema },
      { name: Issue.name, schema: IssueSchema },
      { name: Feedback.name, schema: FeedbackSchema },
    ]),
  ],
  controllers: [DashboardController, ReceptionDashboardController],
  providers: [DashboardService, DashboardClock, ReceptionDashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
