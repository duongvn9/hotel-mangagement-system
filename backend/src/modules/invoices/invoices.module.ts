import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Invoice, InvoiceSchema } from './schemas/invoice.schema.js';

@Module({
  imports: [MongooseModule.forFeature([{ name: Invoice.name, schema: InvoiceSchema }])],
  exports: [MongooseModule],
})
export class InvoicesModule {}
