import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Booking, BookingStatus } from '../bookings/schemas/booking.schema.js';
import type {
  AddCheckoutChargeDto,
  BookingChargesResponse,
} from './dto/checkout-charge.dto.js';
import { InvoicesService } from './invoices.service.js';
import { InvoiceChargeType } from './schemas/invoice-charge.schema.js';
import type { InvoiceDocument } from './schemas/invoice.schema.js';

@Injectable()
export class CheckoutChargesService {
  constructor(
    @InjectModel(Booking.name) private readonly bookings: Model<Booking>,
    private readonly invoices: InvoicesService,
  ) {}

  /**
   * UC17: lễ tân ghi một khoản phụ phí cho khách đang ở. Chỉ nhận booking CHECKED_IN. `requestId`
   * làm khoá chống trùng: gửi lại đúng nội dung thì không ghi thêm, khác nội dung thì 409.
   */
  async add(
    bookingId: string,
    dto: AddCheckoutChargeDto,
  ): Promise<BookingChargesResponse> {
    const booking = await this.booking(bookingId);
    if (booking.status !== BookingStatus.CheckedIn) {
      throw new ConflictException(
        'Additional charges can only be recorded for a guest who is checked in',
      );
    }
    const invoice = await this.invoices.addCharge({
      bookingId,
      type: InvoiceChargeType.Additional,
      amount: dto.amount,
      reason: dto.reason,
      sourceId: `checkout:${dto.requestId}`,
    });
    return this.response(booking, invoice);
  }

  /** Các khoản phí và tổng hợp hóa đơn hiện tại của booking. */
  async list(bookingId: string): Promise<BookingChargesResponse> {
    const booking = await this.booking(bookingId);
    const invoice = await this.invoices.getOrCreateForBooking(bookingId);
    return this.response(booking, invoice);
  }

  private async booking(bookingId: string) {
    if (!/^[a-f\d]{24}$/i.test(bookingId)) {
      throw new BadRequestException('Invalid booking ID');
    }
    const booking = await this.bookings.findById(bookingId);
    if (!booking || !booking.isActive) {
      throw new NotFoundException('Booking not found');
    }
    return booking;
  }

  private response(
    booking: { _id: unknown; code: string; status: string },
    invoice: InvoiceDocument,
  ): BookingChargesResponse {
    return {
      bookingId: String(booking._id),
      code: booking.code,
      status: booking.status,
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
}
