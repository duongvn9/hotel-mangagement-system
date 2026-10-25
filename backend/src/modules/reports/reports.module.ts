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
    MongooseModule.forFeature([
      { name: PaymentTransaction.name, schema: PaymentTransactionSchema },
    ]),
  ],
  controllers: [ReportsController],
  providers: [RevenueReportService, RevenueReportClock],
  exports: [RevenueReportService],
})
export class ReportsModule {}
