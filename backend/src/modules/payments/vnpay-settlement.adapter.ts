import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { BookingStatus } from '../../common/constants/booking-status.enum.js';
import { Booking } from '../bookings/schemas/booking.schema.js';
import { withBookingFinancialOperation } from '../bookings/booking-financial-operation.js';
import { RoomHold } from '../bookings/schemas/room-hold.schema.js';
import {
  Invoice,
  InvoiceStatus,
  type InvoiceDocument,
} from '../invoices/schemas/invoice.schema.js';
import {
  PaymentPurpose,
  PaymentStatus,
  PaymentTransaction,
} from './schemas/payment-transaction.schema.js';
import {
  VnpaySettlementPort,
  type ExpectedVnpayPayment,
  type VnpayIpnPlan,
} from './vnpay.service.js';

type CompareAndSet = Extract<VnpayIpnPlan, { action: 'compare-and-set' }>;

/** Booking coi như đã nhận cọc (cọc giao lại là idempotent, không cần confirm lại). */
const CONFIRMED_STATUSES: readonly BookingStatus[] = [
  BookingStatus.Confirmed,
  BookingStatus.CheckedIn,
  BookingStatus.CheckedOut,
];

/**
 * Mongo adapter cho VnpaySettlementPort: ghi nhận bền vững một giao dịch VNPay.
 *
 * Bước quan trọng nhất là compare-and-set trên PaymentTransaction (PENDING -> terminal).
 * Đây là bản ghi tiền authoritative và không phụ thuộc pricing, nên tiền luôn được ghi
 * nhận kể cả khi nguồn giá (H3/H4) chưa cấu hình. Tổng tiền hoá đơn (roomTotal, ...)
 * vẫn do H7 `InvoicesService.recalculate` chịu trách nhiệm; adapter này chỉ cập nhật
 * các trường phát sinh từ payment (depositPaid/finalPaid/balanceDue) theo đúng công thức
 * của H7 và chỉ khi hoá đơn đã có totalAmount đủ lớn.
 */
@Injectable()
export class MongoVnpaySettlementPort extends VnpaySettlementPort {
  private readonly logger = new Logger(MongoVnpaySettlementPort.name);

  constructor(
    @InjectModel(PaymentTransaction.name)
    private readonly payments: Model<PaymentTransaction>,
    @InjectModel(Booking.name) private readonly bookings: Model<Booking>,
    @InjectModel(RoomHold.name) private readonly holds: Model<RoomHold>,
    @InjectModel(Invoice.name) private readonly invoices: Model<Invoice>,
  ) {
    super();
  }

  async commitAtomically(
    expected: ExpectedVnpayPayment,
    plan: CompareAndSet,
  ): Promise<'committed' | 'duplicate' | 'conflict'> {
    return withBookingFinancialOperation(
      this.bookings,
      expected.booking.id,
      () => this.commitLocked(expected, plan),
    );
  }

  private async commitLocked(
    expected: ExpectedVnpayPayment,
    plan: CompareAndSet,
  ): Promise<'committed' | 'duplicate' | 'conflict'> {
    const { result } = plan;
    const update: Record<string, unknown> = {
      status: result.status,
      providerTransactionRef: result.providerTransactionRef,
      ...(result.paidAt === undefined ? {} : { paidAt: result.paidAt }),
    };

    let settled;
    try {
      settled = await this.payments.findOneAndUpdate(
        {
          transactionRef: result.transactionRef,
          booking: new Types.ObjectId(expected.booking.id),
          invoice: new Types.ObjectId(expected.invoice.id),
          status: PaymentStatus.Pending,
          providerTransactionRef: { $exists: false },
          isActive: true,
        },
        { $set: update },
        { new: true },
      );
    } catch (error) {
      // Unique index (method, providerTransactionRef): cùng một mã giao dịch VNPay
      // không được gắn vào hai payment khác nhau.
      if ((error as { code?: number }).code === 11000) return 'conflict';
      throw error;
    }

    if (!settled) {
      const current = await this.payments.findOne({
        transactionRef: result.transactionRef,
      });
      if (
        current &&
        current.status === result.status &&
        current.providerTransactionRef === result.providerTransactionRef
      ) {
        if (result.status === PaymentStatus.Success) {
          if (current.purpose === PaymentPurpose.Deposit) {
            if (!(await this.confirmDeposit(expected, result.transactionRef)))
              return 'duplicate';
          }
          await this.reconcileInvoice(expected);
        }
        return 'duplicate';
      }
      return 'conflict';
    }

    if (result.status === PaymentStatus.Success) {
      if (expected.payment.purpose === PaymentPurpose.Deposit) {
        // Tiền đã về nhưng chỉ confirm khi booking còn giữ phòng hợp lệ. Nếu không
        // (hết hạn/đã huỷ do callback về muộn) thì ghi nhận để đối soát, không confirm.
        const confirmed = await this.confirmDeposit(
          expected,
          result.transactionRef,
        );
        if (!confirmed) return 'committed';
      }
      await this.reconcileInvoice(expected);
    }

    return 'committed';
  }

  /**
   * Chuyển booking PENDING_DEPOSIT -> CONFIRMED và chấm dứt hold khi cọc thành công.
   * Kiểm tra kết quả update (không tin mù): nếu không chuyển được vì booking đã
   * EXPIRED/CANCELLED (tiền về muộn) thì đánh dấu payment để đối soát và trả false.
   * Idempotent: cọc giao lại cho booking đã CONFIRMED/CHECKED_* vẫn coi là thành công.
   */
  private async confirmDeposit(
    expected: ExpectedVnpayPayment,
    transactionRef: string,
  ): Promise<boolean> {
    const bookingId = new Types.ObjectId(expected.booking.id);
    const updated = await this.bookings.updateOne(
      {
        _id: bookingId,
        status: BookingStatus.PendingDeposit,
        isActive: true,
      },
      { $set: { status: BookingStatus.Confirmed } },
    );
    if (updated.modifiedCount === 1) {
      await this.deactivateHold(bookingId);
      return true;
    }

    const booking = await this.bookings
      .findById(bookingId)
      .select('status isActive')
      .lean();
    if (
      booking &&
      booking.isActive &&
      CONFIRMED_STATUSES.includes(booking.status)
    ) {
      // Cọc giao lại cho booking đã xác nhận: không đổi gì thêm, hold đã nhả.
      await this.deactivateHold(bookingId);
      return true;
    }

    await this.payments.updateOne(
      { transactionRef },
      { $set: { needsReconciliation: true } },
    );
    this.logger.warn(
      `Deposit ${transactionRef} settled but booking ${expected.booking.id} ` +
        `is not confirmable (${booking?.status ?? 'missing'}); flagged for reconciliation`,
    );
    return false;
  }

  private async deactivateHold(bookingId: Types.ObjectId): Promise<void> {
    await this.holds.updateMany(
      { booking: bookingId, isActive: true },
      { $set: { isActive: false } },
    );
  }

  /**
   * Cập nhật depositPaid/finalPaid/balanceDue từ các payment SUCCESS (giống H7).
   * Best-effort: nếu hoá đơn chưa có totalAmount hợp lệ (pricing chưa cấu hình) thì bỏ qua;
   * payment đã SUCCESS nên H7 recalculate sẽ hội tụ khi có nguồn giá.
   */
  private async reconcileInvoice(
    expected: ExpectedVnpayPayment,
  ): Promise<void> {
    const invoiceId = new Types.ObjectId(expected.invoice.id);
    for (let attempt = 0; attempt < 5; attempt++) {
      const invoice = await this.invoices.findById(invoiceId);
      if (!invoice || !invoice.isActive) return;

      const paid = await this.payments
        .find({
          booking: new Types.ObjectId(expected.booking.id),
          invoice: invoiceId,
          status: PaymentStatus.Success,
          isActive: true,
        })
        .select('purpose amount')
        .lean()
        .exec();
      const sum = (purpose: PaymentPurpose) =>
        paid
          .filter((payment) => payment.purpose === purpose)
          .reduce((total, payment) => total + payment.amount, 0);
      const depositPaid = sum(PaymentPurpose.Deposit);
      const finalPaid = sum(PaymentPurpose.Final);
      const balanceDue = invoice.totalAmount - depositPaid - finalPaid;
      if (balanceDue < 0) {
        this.logger.warn(
          `Invoice ${invoice.code} total not yet priced for payments; leaving reconciliation to H7`,
        );
        return;
      }

      invoice.depositPaid = depositPaid;
      invoice.finalPaid = finalPaid;
      invoice.balanceDue = balanceDue;
      invoice.status = this.invoiceStatus(invoice);
      try {
        await invoice.save();
        return;
      } catch (error) {
        if ((error as Error).name !== 'VersionError') throw error;
      }
    }
    this.logger.warn(
      `Invoice ${expected.invoice.id} changed concurrently during settlement reconciliation`,
    );
  }

  private invoiceStatus(invoice: InvoiceDocument): InvoiceStatus {
    const paid = invoice.depositPaid + invoice.finalPaid;
    if (paid <= 0) return InvoiceStatus.Unpaid;
    if (invoice.balanceDue <= 0) return InvoiceStatus.Paid;
    return InvoiceStatus.PartiallyPaid;
  }
}
