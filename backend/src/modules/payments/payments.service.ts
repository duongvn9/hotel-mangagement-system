import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { randomBytes } from 'node:crypto';
import { Model, Types } from 'mongoose';
import {
  BookingStatus,
  UNCONFIRMED_BOOKING_STATUSES,
} from '../../common/constants/booking-status.enum.js';
import {
  authorizeBookingAccess,
  type BookingActor,
} from '../../common/auth/booking-access.js';
import {
  Booking,
  type BookingDocument,
} from '../bookings/schemas/booking.schema.js';
import { RoomHold } from '../bookings/schemas/room-hold.schema.js';
import { InvoicesService } from '../invoices/invoices.service.js';
import {
  PaymentMethod,
  PaymentPurpose,
  PaymentStatus,
  PaymentTransaction,
} from './schemas/payment-transaction.schema.js';
import {
  VnpayService,
  VnpaySettlementPort,
  type ExpectedVnpayPayment,
} from './vnpay.service.js';
import { VnpayValidationError } from './vnpay.protocol.js';

export interface InitiateOptions {
  locale?: 'vn' | 'en';
  bankCode?: string;
  ipAddress: string;
}

export interface IpnResponse {
  RspCode: string;
  Message: string;
}

/** Thời hạn một lần thanh toán VNPay trước khi hết hiệu lực. */
const PAYMENT_WINDOW_MS = 15 * 60 * 1000;

@Injectable()
export class PaymentsService {
  constructor(
    @InjectModel(PaymentTransaction.name)
    private readonly payments: Model<PaymentTransaction>,
    @InjectModel(Booking.name) private readonly bookings: Model<Booking>,
    @InjectModel(RoomHold.name) private readonly holds: Model<RoomHold>,
    private readonly invoices: InvoicesService,
    private readonly vnpay: VnpayService,
    private readonly settlement: VnpaySettlementPort,
  ) {}

  async initiateDeposit(
    bookingId: string,
    actor: BookingActor,
    options: InitiateOptions,
  ) {
    const booking = await this.authorizedBooking(bookingId, actor);
    if (booking.status !== BookingStatus.PendingDeposit) {
      throw new ConflictException('Booking is not awaiting a deposit');
    }
    // Chỉ cho đặt cọc khi hold còn hợp lệ; deadline thanh toán trùng thời hạn giữ phòng.
    const holdExpiresAt = await this.requireValidHold(booking);
    return this.initiate(
      booking,
      PaymentPurpose.Deposit,
      booking.depositAmount,
      options,
      holdExpiresAt,
    );
  }

  /**
   * Cọc chỉ hợp lệ khi phòng còn được giữ. Nếu hold đã hết hạn/mất hiệu lực thì chủ động
   * chuyển booking chưa xác nhận sang EXPIRED và chặn thanh toán (thống nhất deadline).
   */
  private async requireValidHold(booking: BookingDocument): Promise<Date> {
    const hold = await this.holds
      .findOne({ booking: booking._id })
      .sort({ createdAt: -1 });
    const now = Date.now();
    if (!hold || !hold.isActive || hold.expiresAt.getTime() <= now) {
      await this.bookings.updateOne(
        {
          _id: booking._id,
          status: { $in: UNCONFIRMED_BOOKING_STATUSES },
          isActive: true,
        },
        { $set: { status: BookingStatus.Expired } },
      );
      if (hold?.isActive) {
        await this.holds.updateOne(
          { _id: hold._id },
          { $set: { isActive: false } },
        );
      }
      throw new ConflictException(
        'Room hold has expired; please start a new booking',
      );
    }
    return hold.expiresAt;
  }

  async initiateFinal(
    bookingId: string,
    actor: BookingActor,
    options: InitiateOptions,
  ) {
    const booking = await this.authorizedBooking(bookingId, actor);
    if (
      [BookingStatus.Cancelled, BookingStatus.PendingDeposit].includes(
        booking.status,
      )
    ) {
      throw new ConflictException('Booking is not ready for a final payment');
    }
    // Dư nợ lấy từ H7 tại thời điểm khởi tạo, không nhận tổng tiền từ frontend.
    const invoice = await this.invoices.recalculate(bookingId);
    return this.initiate(
      booking,
      PaymentPurpose.Final,
      invoice.balanceDue,
      options,
    );
  }

  private async initiate(
    booking: BookingDocument,
    purpose: PaymentPurpose,
    amount: number,
    options: InitiateOptions,
    expiresAt?: Date,
  ) {
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      throw new ConflictException('No positive amount is payable');
    }
    const invoice = await this.invoices.getOrCreateForBooking(
      String(booking._id),
    );

    if (
      await this.payments.exists({
        booking: booking._id,
        purpose,
        status: PaymentStatus.Success,
        isActive: true,
      })
    ) {
      throw new ConflictException('This payment has already been settled');
    }
    if (
      await this.payments.exists({
        booking: booking._id,
        purpose,
        status: PaymentStatus.Pending,
        isActive: true,
      })
    ) {
      throw new ConflictException('A pending payment already exists');
    }

    const payment = await this.payments.create({
      booking: booking._id,
      invoice: invoice._id,
      transactionRef: this.newTransactionRef(),
      method: PaymentMethod.Vnpay,
      purpose,
      status: PaymentStatus.Pending,
      amount,
    });

    const now = new Date();
    const paymentUrl = this.vnpay.createPaymentUrl(
      this.expected(payment.toObject(), booking, invoice._id),
      {
        ipAddress: options.ipAddress,
        createdAt: now,
        // Deadline thanh toán không vượt quá thời hạn giữ phòng (nếu có hold).
        expiresAt: expiresAt ?? new Date(now.getTime() + PAYMENT_WINDOW_MS),
        ...(options.locale === undefined ? {} : { locale: options.locale }),
        ...(options.bankCode === undefined
          ? {}
          : { bankCode: options.bankCode }),
      },
    );
    return { transactionRef: payment.transactionRef, paymentUrl, amount };
  }

  /** Trang Return chỉ xác minh chữ ký và đọc kết quả, không đổi trạng thái. */
  async verifyReturn(rawQuery: string) {
    const expected = await this.loadExpected(rawQuery);
    try {
      const result = this.vnpay.verifyReturn(rawQuery, expected);
      return {
        transactionRef: result.transactionRef,
        status: result.status,
        responseCode: result.responseCode,
      };
    } catch (error) {
      if (error instanceof VnpayValidationError) {
        throw new BadRequestException(`Invalid VNPay return: ${error.reason}`);
      }
      throw error;
    }
  }

  /** IPN xử lý bền vững; chỉ ACK sau khi đã commit settlement. */
  async processIpn(rawQuery: string): Promise<IpnResponse> {
    let expected: ExpectedVnpayPayment;
    try {
      expected = await this.loadExpected(rawQuery);
    } catch {
      return { RspCode: '01', Message: 'Order not found' };
    }
    try {
      const plan = this.vnpay.prepareIpn(rawQuery, expected);
      if (plan.action === 'duplicate') {
        return { RspCode: '02', Message: 'Order already confirmed' };
      }
      if (plan.action === 'review') {
        return { RspCode: '99', Message: 'Unknown error' };
      }
      const outcome = await this.settlement.commitAtomically(expected, plan);
      return outcome === 'committed'
        ? { RspCode: '00', Message: 'Confirm Success' }
        : { RspCode: '02', Message: 'Order already confirmed' };
    } catch (error) {
      if (error instanceof VnpayValidationError) {
        if (error.reason === 'signature') {
          return { RspCode: '97', Message: 'Invalid signature' };
        }
        if (error.reason === 'amount') {
          return { RspCode: '04', Message: 'Invalid amount' };
        }
      }
      return { RspCode: '99', Message: 'Unknown error' };
    }
  }

  /**
   * Danh sách các khoản tiền về muộn đã ghi nhận SUCCESS nhưng booking không còn nhận
   * được (cần đối soát/hoàn thủ công). Kèm context booking để Manager xử lý.
   */
  async listReconciliation() {
    const rows = await this.payments
      .find({ needsReconciliation: true, isActive: true })
      .sort({ createdAt: -1 })
      .populate('booking', 'code status')
      .lean();
    const items = rows.map((row) => {
      const booking = row.booking as unknown as {
        _id: Types.ObjectId;
        code?: string;
        status?: string;
      } | null;
      return {
        id: String(row._id),
        transactionRef: row.transactionRef,
        purpose: row.purpose,
        amount: row.amount,
        ...(row.providerTransactionRef
          ? { providerTransactionRef: row.providerTransactionRef }
          : {}),
        ...(row.paidAt ? { paidAt: row.paidAt } : {}),
        bookingId: String(booking?._id ?? row.booking),
        ...(booking?.code ? { bookingCode: booking.code } : {}),
        ...(booking?.status ? { bookingStatus: booking.status } : {}),
        createdAt: (row as unknown as { createdAt: Date }).createdAt,
      };
    });
    return { items, total: items.length };
  }

  /**
   * Manager đánh dấu một khoản đã đối soát (tiền thật đã xử lý ngoài hệ thống, vd hoàn
   * qua cổng VNPay): tắt cờ needsReconciliation, lưu người/thời điểm xử lý và ghi chú.
   */
  async reconcile(id: string, userId: string, note?: string) {
    if (!/^[a-f\d]{24}$/i.test(id)) {
      throw new BadRequestException('Invalid payment ID');
    }
    const payment = await this.payments.findById(id);
    if (!payment || !payment.isActive) {
      throw new NotFoundException('Payment not found');
    }
    if (!payment.needsReconciliation) {
      throw new ConflictException('Payment does not need reconciliation');
    }
    payment.needsReconciliation = false;
    payment.reconciledAt = new Date();
    payment.reconciledBy = new Types.ObjectId(userId);
    const trimmed = note?.trim();
    if (trimmed) payment.reconciliationNote = trimmed;
    await payment.save();
    return {
      id: String(payment._id),
      transactionRef: payment.transactionRef,
      needsReconciliation: payment.needsReconciliation,
      reconciledAt: payment.reconciledAt,
      reconciledBy: String(payment.reconciledBy),
      ...(payment.reconciliationNote
        ? { reconciliationNote: payment.reconciliationNote }
        : {}),
    };
  }

  private async loadExpected(rawQuery: string): Promise<ExpectedVnpayPayment> {
    const transactionRef = new URLSearchParams(rawQuery).get('vnp_TxnRef');
    if (!transactionRef || !/^[A-Za-z0-9]{1,100}$/.test(transactionRef)) {
      throw new NotFoundException('Payment not found');
    }
    const payment = await this.payments.findOne({ transactionRef });
    if (!payment) throw new NotFoundException('Payment not found');
    const booking = await this.bookings.findById(payment.booking);
    if (!booking) throw new NotFoundException('Booking not found');
    return this.expected(payment.toObject(), booking, payment.invoice);
  }

  private expected(
    payment: PaymentTransaction,
    booking: Pick<BookingDocument, '_id' | 'isActive'>,
    invoiceId: Types.ObjectId,
  ): ExpectedVnpayPayment {
    return {
      payment,
      booking: { id: String(booking._id), isActive: booking.isActive },
      invoice: {
        id: String(invoiceId),
        bookingId: String(booking._id),
        isActive: true,
      },
    };
  }

  private async authorizedBooking(
    bookingId: string,
    actor: BookingActor,
  ): Promise<BookingDocument> {
    if (!/^[a-f\d]{24}$/i.test(bookingId)) {
      throw new BadRequestException('Invalid booking ID');
    }
    const booking = await this.bookings.findById(bookingId);
    if (!booking || !booking.isActive) {
      throw new NotFoundException('Booking not found');
    }
    authorizeBookingAccess(booking, actor);
    return booking;
  }

  private newTransactionRef(): string {
    return `${Date.now().toString(36)}${randomBytes(10).toString('hex')}`;
  }
}
