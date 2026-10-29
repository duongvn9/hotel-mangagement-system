import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { withBookingFinancialOperation } from '../bookings/booking-financial-operation.js';
import { Booking, BookingStatus } from '../bookings/schemas/booking.schema.js';
import {
  PaymentMethod,
  PaymentPurpose,
  PaymentStatus,
  PaymentTransaction,
} from '../payments/schemas/payment-transaction.schema.js';
import type { RecordCashPaymentDto } from './dto/cash-payment.dto.js';
import type { BookingChargesResponse } from './dto/checkout-charge.dto.js';
import { toBookingChargesResponse } from './invoice-summary.js';
import { InvoicesService } from './invoices.service.js';

@Injectable()
export class CashPaymentService {
  constructor(
    @InjectModel(Booking.name) private readonly bookings: Model<Booking>,
    @InjectModel(PaymentTransaction.name)
    private readonly payments: Model<PaymentTransaction>,
    private readonly invoices: InvoicesService,
  ) {}

  async record(
    bookingId: string,
    dto: RecordCashPaymentDto,
  ): Promise<BookingChargesResponse> {
    return withBookingFinancialOperation(this.bookings, bookingId, () =>
      this.recordLocked(bookingId, dto),
    );
  }

  private async recordLocked(
    bookingId: string,
    dto: RecordCashPaymentDto,
  ): Promise<BookingChargesResponse> {
    if (!/^[a-f\d]{24}$/i.test(bookingId)) {
      throw new BadRequestException('Invalid booking ID');
    }
    const booking = await this.bookings.findById(bookingId);
    if (!booking || !booking.isActive) {
      throw new NotFoundException('Booking not found');
    }
    const transactionRef = `CASH-${dto.requestId}`;
    const replay = await this.payments.findOne({ transactionRef });
    if (replay) return this.replayed(booking, replay);
    if (booking.status !== BookingStatus.CheckedIn) {
      throw new ConflictException(
        'Cash can only be taken for a guest who is checked in',
      );
    }

    const invoice = await this.invoices.recalculate(bookingId);
    const filter = {
      booking: booking._id,
      purpose: PaymentPurpose.Final,
      isActive: true,
    };
    if (
      await this.payments.exists({ ...filter, status: PaymentStatus.Pending })
    ) {
      throw new ConflictException(
        'A VNPay payment is still pending; wait for it to finish or fail',
      );
    }
    if (invoice.balanceDue <= 0) {
      throw new ConflictException('Nothing left to pay on this invoice');
    }

    try {
      await this.payments.create({
        booking: booking._id,
        invoice: invoice._id,
        transactionRef,
        method: PaymentMethod.Cash,
        purpose: PaymentPurpose.Final,
        status: PaymentStatus.Success,
        amount: invoice.balanceDue,
        paidAt: new Date(),
      });
    } catch (error) {
      if ((error as { code?: number }).code !== 11000) throw error;
      const winner = await this.payments.findOne({ transactionRef });
      if (winner) return this.replayed(booking, winner);
      throw error;
    }

    return toBookingChargesResponse(
      booking,
      await this.invoices.recalculate(bookingId),
    );
  }

  /** Cùng requestId gửi lại: trả kết quả hiện tại nếu đúng là khoản thu này, ngược lại báo xung đột. */
  private async replayed(
    booking: { _id: Types.ObjectId; code: string; status: string },
    payment: PaymentTransaction & { _id: Types.ObjectId },
  ): Promise<BookingChargesResponse> {
    if (
      !payment.booking.equals(booking._id) ||
      payment.method !== PaymentMethod.Cash ||
      payment.purpose !== PaymentPurpose.Final ||
      payment.status !== PaymentStatus.Success
    ) {
      throw new ConflictException('This request id was already used');
    }
    return toBookingChargesResponse(
      booking,
      await this.invoices.recalculate(String(booking._id)),
    );
  }
}
