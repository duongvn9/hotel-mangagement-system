import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { Booking, BookingSchema } from '../bookings/schemas/booking.schema.js';
import { Invoice, InvoiceSchema } from '../invoices/schemas/invoice.schema.js';
import {
  PaymentTransaction,
  PaymentTransactionSchema,
} from './schemas/payment-transaction.schema.js';
import { VnpayService, VnpaySettlementPort } from './vnpay.service.js';
import { MongoVnpaySettlementPort } from './vnpay-settlement.adapter.js';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: PaymentTransaction.name, schema: PaymentTransactionSchema },
      { name: Booking.name, schema: BookingSchema },
      { name: Invoice.name, schema: InvoiceSchema },
    ]),
  ],
  providers: [
    VnpayService,
    { provide: VnpaySettlementPort, useClass: MongoVnpaySettlementPort },
  ],
  exports: [MongooseModule, VnpayService, VnpaySettlementPort],
})
export class PaymentsModule {}
