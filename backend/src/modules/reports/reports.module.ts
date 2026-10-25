import { Booking, BookingSchema } from '../bookings/schemas/booking.schema.js';
import { Room, RoomSchema } from '../rooms/schemas/room.schema.js';
import {
  ServiceOrder,
  ServiceOrderSchema,
} from '../service-orders/schemas/service-order.schema.js';
import { Issue, IssueSchema } from '../issues/schemas/issue.schema.js';
import {
  Maintenance,
  MaintenanceSchema,
} from '../maintenance/schemas/maintenance.schema.js';
import { Task, TaskSchema } from '../tasks/schemas/task.schema.js';
import { TaskSupervisionModule } from '../task-supervision/task-supervision.module.js';
import { OperationalReportController } from './operational-report.controller.js';
import {
  OperationalReportService,
  OperationalReportClock,
} from './operational-report.service.js';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  PaymentTransaction,
  PaymentTransactionSchema,
} from '../payments/schemas/payment-transaction.schema.js';
import {
  RevenueReportClock,
  RevenueReportService,
} from './revenue-report.service.js';
import { ReportsController } from './reports.controller.js';
@Module({
  imports: [
    TaskSupervisionModule,
    MongooseModule.forFeature([
      { name: PaymentTransaction.name, schema: PaymentTransactionSchema },
      { name: Booking.name, schema: BookingSchema },
      { name: Room.name, schema: RoomSchema },
      { name: ServiceOrder.name, schema: ServiceOrderSchema },
      { name: Issue.name, schema: IssueSchema },
      { name: Maintenance.name, schema: MaintenanceSchema },
      { name: Task.name, schema: TaskSchema },
    ]),
  ],
  controllers: [ReportsController, OperationalReportController],
  providers: [
    RevenueReportService,
    RevenueReportClock,
    OperationalReportService,
    OperationalReportClock,
  ],
  exports: [RevenueReportService, OperationalReportService],
})
export class ReportsModule {}
