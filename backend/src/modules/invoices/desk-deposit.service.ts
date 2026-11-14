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

/**
 * Thu tiền cọc của booking tại quầy (tiền mặt hoặc thẻ), dùng cho booking lễ tân đặt hộ khách
 * (vào thẳng CONFIRMED nhưng chưa có khoản cọc nào). Số tiền luôn là tiền cọc của booking.
 */
@Injectable()
export class DeskDepositService {
  constructor(
    @InjectModel(Booking.name) private readonly bookings: Model<Booking>,
    @InjectModel(PaymentTransaction.name)
    private readonly payments: Model<PaymentTransaction>,
    private readonly invoices: InvoicesService,
  ) {}

  async record(
    bookingId: string,
    dto: Pick<RecordCashPaymentDto, 'requestId'>,
    method: PaymentMethod.Cash | PaymentMethod.Card,
  ): Promise<BookingChargesResponse> {
    return withBookingFinancialOperation(this.bookings, bookingId, () =>
      this.recordLocked(bookingId, dto, method),
    );
  }

  private async recordLocked(
    bookingId: string,
    dto: Pick<RecordCashPaymentDto, 'requestId'>,
    method: PaymentMethod.Cash | PaymentMethod.Card,
  ): Promise<BookingChargesResponse> {
    if (!/^[a-f\d]{24}$/i.test(bookingId)) {
      throw new BadRequestException('Invalid booking ID');
    }
    const booking = await this.bookings.findById(bookingId);
    if (!booking || !booking.isActive) {
      throw new NotFoundException('Booking not found');
    }
    const transactionRef = `DEPOSIT-${method}-${dto.requestId}`;
    const replay = await this.payments.findOne({ transactionRef });
    if (replay) return this.replayed(booking, replay, method);

    if (booking.status !== BookingStatus.Confirmed) {
      throw new ConflictException(
        'A deposit can only be taken at the desk for a confirmed booking',
      );
    }
    if (!(booking.depositAmount > 0)) {
      throw new ConflictException('This booking has no deposit to take');
    }
    const filter = {
      booking: booking._id,
      purpose: PaymentPurpose.Deposit,
      isActive: true,
    };
    if (
      await this.payments.exists({ ...filter, status: PaymentStatus.Success })
    ) {
      throw new ConflictException('The deposit has already been paid');
    }
    // A VNPay link the guest walked away from stays PENDING and cannot be cancelled on VNPay's
    // side. The guest is now paying at the desk, so supersede it the same way a re-initiated
    // VNPay payment does: it becomes CANCELLED, and if VNPay still reports it paid later the IPN
    // flags it for manual reconciliation instead of adding it to the invoice.
    await this.payments.updateMany(
      { ...filter, method: PaymentMethod.Vnpay, status: PaymentStatus.Pending },
      { $set: { status: PaymentStatus.Cancelled, supersededAt: new Date() } },
    );

    const invoice = await this.invoices.getOrCreateForBooking(bookingId);
    try {
      await this.payments.create({
        booking: booking._id,
        invoice: invoice._id,
        transactionRef,
        method,
        purpose: PaymentPurpose.Deposit,
        status: PaymentStatus.Success,
        amount: booking.depositAmount,
        paidAt: new Date(),
      });
    } catch (error) {
      if ((error as { code?: number }).code !== 11000) throw error;
      const winner = await this.payments.findOne({ transactionRef });
      if (winner) return this.replayed(booking, winner, method);
      throw error;
    }
    return toBookingChargesResponse(
      booking,
      await this.invoices.recalculate(bookingId),
    );
  }

  /** Cùng requestId gửi lại: trả kết quả hiện tại nếu đúng là khoản cọc này, ngược lại báo xung đột. */
  private async replayed(
    booking: { _id: Types.ObjectId; code: string; status: string },
    payment: PaymentTransaction & { _id: Types.ObjectId },
    method: PaymentMethod,
  ): Promise<BookingChargesResponse> {
    if (
      !payment.booking.equals(booking._id) ||
      payment.method !== method ||
      payment.purpose !== PaymentPurpose.Deposit ||
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
