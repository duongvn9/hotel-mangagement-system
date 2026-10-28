import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
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

  /**
   * UC18: lễ tân xác nhận đã thu tiền mặt thanh toán cuối. Số tiền luôn là số còn phải trả do
   * server tính lại từ hóa đơn. `requestId` làm khoá chống trùng. Chỉ một thanh toán cuối được
   * ghi nhận cho mỗi booking (giống VNPay) và không ghi khi còn giao dịch VNPay đang chờ.
   */
  async record(
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
    if (booking.status !== BookingStatus.CheckedIn) {
      throw new ConflictException(
        'Cash can only be taken for a guest who is checked in',
      );
    }

    const transactionRef = `CASH-${dto.requestId}`;
    const replay = await this.payments.findOne({ transactionRef });
    if (replay) return this.replayed(booking, replay);

    const invoice = await this.invoices.recalculate(bookingId);
    const filter = {
      booking: booking._id,
      purpose: PaymentPurpose.Final,
      isActive: true,
    };
    if (
      await this.payments.exists({ ...filter, status: PaymentStatus.Success })
    ) {
      throw new ConflictException('The final payment has already been settled');
    }
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

    let payment;
    try {
      payment = await this.payments.create({
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

    // Hai lễ tân thu cùng lúc: khoản tạo trước (_id nhỏ hơn) được giữ, khoản còn lại bị xoá.
    const settled = await this.payments
      .find({ ...filter, status: PaymentStatus.Success })
      .sort({ _id: 1 })
      .select('_id')
      .lean()
      .exec();
    if (settled[0] && !settled[0]._id.equals(payment._id)) {
      await this.payments.deleteOne({ _id: payment._id });
      throw new ConflictException('The final payment has already been settled');
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
