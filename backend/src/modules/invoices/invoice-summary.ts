import type { BookingChargesResponse } from './dto/checkout-charge.dto.js';
import type { InvoiceDocument } from './schemas/invoice.schema.js';

/** Các khoản phí và tổng hợp hóa đơn của một booking, dùng chung cho UC17 và UC18. */
export function toBookingChargesResponse(
  booking: { _id: unknown; code: string; status: string },
  invoice: InvoiceDocument,
): BookingChargesResponse {
  return {
    bookingId: String(booking._id),
    code: booking.code,
    status: booking.status,
    invoiceStatus: invoice.status,
    totals: {
      roomTotal: invoice.roomTotal,
      serviceTotal: invoice.serviceTotal,
      additionalTotal: invoice.additionalTotal,
      discountTotal: invoice.discountTotal,
      taxTotal: invoice.taxTotal,
      totalAmount: invoice.totalAmount,
      depositPaid: invoice.depositPaid,
      finalPaid: invoice.finalPaid,
      balanceDue: invoice.balanceDue,
    },
    charges: invoice.charges.map((charge) => ({
      type: charge.type,
      amount: charge.amount,
      reason: charge.reason,
      ...(charge.sourceId ? { sourceId: charge.sourceId } : {}),
    })),
  };
}
