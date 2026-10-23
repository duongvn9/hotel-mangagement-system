import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { VnpayService } from './vnpay.service.js';
import { PaymentTransaction, PaymentTransactionSchema } from './schemas/payment-transaction.schema.js';

@Module({
  imports: [ConfigModule, MongooseModule.forFeature([{ name: PaymentTransaction.name, schema: PaymentTransactionSchema }])],
  providers: [VnpayService],
  exports: [MongooseModule, VnpayService],
})
export class PaymentsModule {}
