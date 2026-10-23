import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { randomBytes } from 'node:crypto';
import { Model, Types } from 'mongoose';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { BookingStatus } from '../../common/constants/booking-status.enum.js';
import { Role } from '../../common/constants/role.enum.js';
import {
  Booking,
  type BookingDocument,
} from '../bookings/schemas/booking.schema.js';
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

/** Nhân viên được phép khởi tạo thanh toán thay khách tại quầy. */
const STAFF_ROLES: readonly string[] = [Role.Receptionist, Role.Manager];
/** Thời hạn một lần thanh toán VNPay trước khi hết hiệu lực. */
const PAYMENT_WINDOW_MS = 15 * 60 * 1000;

@Injectable()
export class PaymentsService {
  constructor(
    @InjectModel(PaymentTransaction.name)
    private readonly payments: Model<PaymentTransaction>,
    @InjectModel(Booking.name) private readonly bookings: Model<Booking>,
    private readonly invoices: InvoicesService,
    private readonly vnpay: VnpayService,
    private readonly settlement: VnpaySettlementPort,
  ) {}

  async initiateDeposit(
    bookingId: string,
    user: AuthUser,
    options: InitiateOptions,
  ) {
    const booking = await this.authorizedBooking(bookingId, user);
    if (booking.status !== BookingStatus.PendingDeposit) {
      throw new ConflictException('Booking is not awaiting a deposit');
    }
    return this.initiate(
      booking,
      PaymentPurpose.Deposit,
      booking.depositAmount,
      options,
    );
  }

  async initiateFinal(
    bookingId: string,
    user: AuthUser,
    options: InitiateOptions,
  ) {
    const booking = await this.authorizedBooking(bookingId, user);
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
        expiresAt: new Date(now.getTime() + PAYMENT_WINDOW_MS),
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
    user: AuthUser,
  ): Promise<BookingDocument> {
    if (!/^[a-f\d]{24}$/i.test(bookingId)) {
      throw new BadRequestException('Invalid booking ID');
    }
    const booking = await this.bookings.findById(bookingId);
    if (!booking || !booking.isActive) {
      throw new NotFoundException('Booking not found');
    }
    const ownsBooking =
      booking.customer !== undefined && String(booking.customer) === user.id;
    if (user.role === Role.Customer) {
      if (!ownsBooking) throw new ForbiddenException('Not your booking');
    } else if (!STAFF_ROLES.includes(user.role)) {
      throw new ForbiddenException('Not allowed to take payments');
    }
    return booking;
  }

  private newTransactionRef(): string {
    return `${Date.now().toString(36)}${randomBytes(10).toString('hex')}`;
  }
}
