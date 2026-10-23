import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import {
  PaymentTransaction,
  PaymentTransactionSchema,
} from './schemas/payment-transaction.schema.js';
import { VnpayService } from './vnpay.service.js';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: PaymentTransaction.name, schema: PaymentTransactionSchema },
    ]),
  ],
  providers: [VnpayService],
  exports: [MongooseModule, VnpayService],
})
export class PaymentsModule {}
