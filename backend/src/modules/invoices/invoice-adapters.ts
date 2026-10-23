import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { BookingDocument } from '../bookings/schemas/booking.schema.js';
import type { InvoiceCharge } from './schemas/invoice-charge.schema.js';
import type { InvoiceDocument } from './schemas/invoice.schema.js';

export interface RoomPricingLine {
  roomId: string;
  rate: number;
  units: number;
}

export abstract class InvoicePricingAdapter {
  abstract getRoomLines(booking: BookingDocument): Promise<readonly RoomPricingLine[]>;
}

@Injectable()
export class UnavailableInvoicePricingAdapter extends InvoicePricingAdapter {
  getRoomLines(_booking: BookingDocument): Promise<readonly RoomPricingLine[]> {
    return Promise.reject(new ServiceUnavailableException('Authoritative room pricing snapshot adapter is not configured'));
  }
}

export abstract class InvoiceChargesAdapter {
  abstract getApprovedCharges(invoice: InvoiceDocument): Promise<readonly InvoiceCharge[]>;
}

@Injectable()
export class PersistedInvoiceChargesAdapter extends InvoiceChargesAdapter {
  getApprovedCharges(invoice: InvoiceDocument): Promise<readonly InvoiceCharge[]> {
    if (!invoice.charges.length && [invoice.serviceTotal, invoice.additionalTotal, invoice.discountTotal, invoice.taxTotal].some((amount) => amount > 0)) {
      return Promise.reject(new ServiceUnavailableException('Legacy invoice requires authoritative charge sources before recalculation'));
    }
    return Promise.resolve(invoice.charges);
  }
}
