import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Service } from '../services/schemas/service.schema.js';
import { Booking, BookingStatus } from '../bookings/schemas/booking.schema.js';
import { withBookingFinancialOperation } from '../bookings/booking-financial-operation.js';
import type {
  AddCheckoutChargeDto,
  AddCheckoutServiceDto,
  BookingChargesResponse,
} from './dto/checkout-charge.dto.js';
import {
  PaymentMethod,
  PaymentPurpose,
  PaymentStatus,
  PaymentTransaction,
} from '../payments/schemas/payment-transaction.schema.js';
import { toBookingChargesResponse } from './invoice-summary.js';
import { InvoicesService } from './invoices.service.js';
import { InvoiceChargeType } from './schemas/invoice-charge.schema.js';

@Injectable()
export class CheckoutChargesService {
  constructor(
    @InjectModel(Booking.name) private readonly bookings: Model<Booking>,
    @InjectModel(Service.name) private readonly services: Model<Service>,
    @InjectModel(PaymentTransaction.name)
    private readonly payments: Model<PaymentTransaction>,
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
    return withBookingFinancialOperation(this.bookings, bookingId, () =>
      this.addLocked(bookingId, dto),
    );
  }

  private async addLocked(
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
      ...(dto.category ? { category: dto.category } : {}),
      sourceId: `checkout:${dto.requestId}`,
    });
    return toBookingChargesResponse(booking, invoice);
  }

  /**
   * Lễ tân thêm một dịch vụ/sản phẩm từ danh mục cho khách đang ở: ghi khoản SERVICE bằng đơn giá
   * hiện tại x số lượng. `requestId` chống ghi trùng như `add`.
   */
  async addService(
    bookingId: string,
    dto: AddCheckoutServiceDto,
  ): Promise<BookingChargesResponse> {
    return withBookingFinancialOperation(this.bookings, bookingId, () =>
      this.addServiceLocked(bookingId, dto),
    );
  }

  private async addServiceLocked(
    bookingId: string,
    dto: AddCheckoutServiceDto,
  ): Promise<BookingChargesResponse> {
    const booking = await this.booking(bookingId);
    if (booking.status !== BookingStatus.CheckedIn) {
      throw new ConflictException(
        'Services can only be added for a guest who is checked in',
      );
    }
    const service = await this.services.findById(dto.serviceId);
    if (!service || !service.isActive) {
      throw new NotFoundException('Service not found');
    }
    if (
      service.billable === false ||
      typeof service.price !== 'number' ||
      !Number.isSafeInteger(service.price)
    ) {
      throw new BadRequestException('Service has no price to charge');
    }
    const unit = service.unit ? ` (${service.unit})` : '';
    const invoice = await this.invoices.addCharge({
      bookingId,
      type: InvoiceChargeType.Service,
      amount: service.price * dto.quantity,
      reason: `${service.name} x${dto.quantity}${unit}`,
      sourceId: `frontdesk-service:${dto.requestId}`,
    });
    return toBookingChargesResponse(booking, invoice);
  }

  /**
   * Khách đang ở quầy đã xem và đồng ý các khoản phí: ghi lại thời điểm để lễ tân mới lập hóa đơn
   * cuối. Mọi khoản phí mới (InvoicesService.addCharge) sẽ thu hồi xác nhận này.
   */
  async confirmFees(bookingId: string): Promise<BookingChargesResponse> {
    return withBookingFinancialOperation(this.bookings, bookingId, async () => {
      const booking = await this.booking(bookingId);
      if (booking.status !== BookingStatus.CheckedIn) {
        throw new ConflictException(
          'Fees can only be confirmed for a guest who is checked in',
        );
      }
      const confirmedAt = new Date();
      await this.bookings.updateOne(
        { _id: booking._id, status: BookingStatus.CheckedIn },
        { $set: { checkoutFeesConfirmedAt: confirmedAt } },
      );
      const invoice = await this.invoices.getOrCreateForBooking(bookingId);
      return toBookingChargesResponse(
        {
          _id: booking._id,
          code: booking.code,
          status: booking.status,
          checkoutFeesConfirmedAt: confirmedAt,
        },
        invoice,
      );
    });
  }

  /** Các khoản phí và tổng hợp hóa đơn hiện tại của booking. */
  async list(bookingId: string): Promise<BookingChargesResponse> {
    const booking = await this.booking(bookingId);
    const invoice = await this.invoices.getOrCreateForBooking(bookingId);
    const vnpayPending = Boolean(
      await this.payments.exists({
        booking: booking._id,
        purpose: PaymentPurpose.Final,
        method: PaymentMethod.Vnpay,
        status: PaymentStatus.Pending,
        isActive: true,
      }),
    );
    return toBookingChargesResponse(booking, invoice, { vnpayPending });
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
}
