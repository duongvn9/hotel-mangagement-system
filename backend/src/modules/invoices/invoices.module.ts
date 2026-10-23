import { Module, type DynamicModule, type Type } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Invoice, InvoiceSchema } from './schemas/invoice.schema.js';
import { BookingsModule } from '../bookings/bookings.module.js';
import { PaymentsModule } from '../payments/payments.module.js';
import { InvoicesService } from './invoices.service.js';
import {
  InvoicePricingAdapter,
  InvoiceChargesAdapter,
  UnavailableInvoicePricingAdapter,
  PersistedInvoiceChargesAdapter,
} from './invoice-adapters.js';

@Module({
  imports: [
    BookingsModule,
    PaymentsModule,
    MongooseModule.forFeature([{ name: Invoice.name, schema: InvoiceSchema }]),
  ],
  providers: [
    InvoicesService,
    {
      provide: InvoicePricingAdapter,
      useClass: UnavailableInvoicePricingAdapter,
    },
    {
      provide: InvoiceChargesAdapter,
      useClass: PersistedInvoiceChargesAdapter,
    },
  ],
  exports: [
    MongooseModule,
    InvoicesService,
    InvoicePricingAdapter,
    InvoiceChargesAdapter,
  ],
})
export class InvoicesModule {
  static withAdapters(
    pricing: Type<InvoicePricingAdapter>,
    charges: Type<InvoiceChargesAdapter> = PersistedInvoiceChargesAdapter,
  ): DynamicModule {
    return {
      module: InvoicesModule,
      providers: [
        { provide: InvoicePricingAdapter, useClass: pricing },
        { provide: InvoiceChargesAdapter, useClass: charges },
      ],
      exports: [InvoicesService, InvoicePricingAdapter, InvoiceChargesAdapter],
    };
  }
}
