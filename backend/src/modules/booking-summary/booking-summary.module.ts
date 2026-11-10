import { Module } from '@nestjs/common';
import { BookingsModule } from '../bookings/bookings.module.js';
import { InvoicesModule } from '../invoices/invoices.module.js';
import { ServiceOrdersModule } from '../service-orders/service-orders.module.js';
import { BookingSummaryController } from './booking-summary.controller.js';
import { BookingSummaryService } from './booking-summary.service.js';

/** Màn chi tiết booking (khách và nhân viên); tách riêng để không làm vòng phụ thuộc giữa các module. */
@Module({
  imports: [BookingsModule, InvoicesModule, ServiceOrdersModule],
  controllers: [BookingSummaryController],
  providers: [BookingSummaryService],
})
export class BookingSummaryModule {}
