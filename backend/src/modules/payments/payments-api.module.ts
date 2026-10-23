import { Module } from '@nestjs/common';
import { InvoicesModule } from '../invoices/invoices.module.js';
import { PaymentsModule } from './payments.module.js';
import { PaymentsController } from './payments.controller.js';
import { PaymentsService } from './payments.service.js';

/**
 * Lớp orchestration cho thanh toán VNPay (UC20/UC21): nối VnpayService + settlement
 * (PaymentsModule) với InvoicesService (H7). Tách khỏi PaymentsModule để tránh phụ thuộc
 * vòng với InvoicesModule và giữ tầng schema/protocol độc lập, dễ test.
 */
@Module({
  imports: [PaymentsModule, InvoicesModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsApiModule {}
