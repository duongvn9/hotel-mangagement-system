import { model, Types } from 'mongoose';
import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Invoice, InvoiceSchema } from './schemas/invoice.schema.js';
import { Booking } from '../bookings/schemas/booking.schema.js';
import { PaymentTransaction } from '../payments/schemas/payment-transaction.schema.js';
import {
  InvoicePricingAdapter,
  PersistedInvoiceChargesAdapter,
  UnavailableInvoicePricingAdapter,
} from './invoice-adapters.js';
import { InvoicesModule } from './invoices.module.js';
import { InvoicesService } from './invoices.service.js';
import { NOTIFICATION_OPTIONS } from '../../config/notifications.config.js';

const InvoiceModel = model('H7AdapterInvoice', InvoiceSchema);
describe('invoice adapter contracts', () => {
  it('fails closed for missing pricing and legacy charges', async () => {
    await expect(
      new UnavailableInvoicePricingAdapter().getRoomLines({} as never),
    ).rejects.toThrow('not configured');
    const invoice = new InvoiceModel({
      booking: new Types.ObjectId(),
      code: 'legacy',
      serviceTotal: 1,
    });
    await expect(
      new PersistedInvoiceChargesAdapter().getApprovedCharges(invoice),
    ).rejects.toThrow('Legacy invoice');
  });
  it('rejects unapproved and duplicate-source persisted charges', async () => {
    const invoice = new InvoiceModel({
      booking: new Types.ObjectId(),
      code: 'invalid',
      charges: [
        {
          type: 'SERVICE',
          amount: 0,
          reason: 'Fee',
          sourceId: 'order:1',
          approved: false,
        },
      ],
    });
    await expect(invoice.validate()).rejects.toThrow();
    invoice.charges[0].approved = true;
    invoice.charges.push({
      type: invoice.charges[0].type,
      amount: 0,
      reason: 'Fee',
      sourceId: 'order:1',
      approved: true,
    });
    await expect(invoice.validate()).rejects.toThrow('unique');
  });
  it('supports runtime adapter configuration through Nest DI', async () => {
    class Pricing extends InvoicePricingAdapter {
      async getRoomLines() {
        return [];
      }
    }
    const module = await Test.createTestingModule({
      imports: [InvoicesModule.withAdapters(Pricing)],
    })
      .overrideProvider(getModelToken(Invoice.name))
      .useValue({})
      .overrideProvider(getModelToken(Booking.name))
      .useValue({})
      .overrideProvider(getModelToken('RoomHold'))
      .useValue({})
      .overrideProvider(getModelToken(PaymentTransaction.name))
      .useValue({})
      .overrideProvider(getModelToken('Room'))
      .useValue({})
      .overrideProvider(getModelToken('RoomType'))
      .useValue({})
      .overrideProvider(getModelToken('Amenity'))
      .useValue({})
      .overrideProvider(getModelToken('Service'))
      .useValue({})
      // NotificationsModule (qua BookingsModule) cần options này khi khởi tạo.
      .overrideProvider(NOTIFICATION_OPTIONS)
      .useValue({
        enabled: false,
        user: '',
        appPassword: '',
        fromName: 'Test',
        maxAttempts: 1,
        retryBaseDelayMs: 1,
        sendTimeoutMs: 1000,
        queueCapacity: 100,
        shutdownTimeoutMs: 1000,
      })
      .compile();
    expect(module.get(InvoicePricingAdapter)).toBeInstanceOf(Pricing);
    expect(module.get(InvoicesService)).toBeInstanceOf(InvoicesService);
    await module.close();
  });
});
