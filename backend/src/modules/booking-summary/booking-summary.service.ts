import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { BOOKING_ROOMS_POPULATE } from '../bookings/booking-list-item.js';
import { BookingsService } from '../bookings/bookings.service.js';
import { Booking } from '../bookings/schemas/booking.schema.js';
import { InvoicesService } from '../invoices/invoices.service.js';
import { PaymentTransaction } from '../payments/schemas/payment-transaction.schema.js';
import {
  ServiceOrderExecutionStatus,
  ServiceOrderReviewStatus,
} from '../service-orders/service-order-status.js';
import { ServiceOrder } from '../service-orders/schemas/service-order.schema.js';
import type {
  BookingSummaryResponse,
  SummaryServiceOrder,
} from './dto/booking-summary.dto.js';

/** Trạng thái hiển thị của một yêu cầu dịch vụ, gộp từ trạng thái duyệt và thực hiện. */
function serviceOrderStatus(order: {
  reviewStatus: ServiceOrderReviewStatus;
  executionStatus: ServiceOrderExecutionStatus;
}): SummaryServiceOrder['status'] {
  if (
    order.reviewStatus === ServiceOrderReviewStatus.Rejected ||
    order.reviewStatus === ServiceOrderReviewStatus.Abandoned
  ) {
    return 'CANCELLED';
  }
  if (order.executionStatus === ServiceOrderExecutionStatus.Completed) {
    return 'DONE';
  }
  if (order.executionStatus === ServiceOrderExecutionStatus.InProgress) {
    return 'IN_PROGRESS';
  }
  return 'PENDING';
}

interface SummaryRoomDoc {
  roomNumber?: string;
  roomType?: { name?: string };
}

/**
 * Tổng hợp một booking cho màn chi tiết: lưu trú, khách, phòng, hoá đơn, thanh toán và yêu cầu
 * dịch vụ. Quyền đọc giống GET /bookings/:id (chủ booking, nhân viên, hoặc mã booking).
 */
@Injectable()
export class BookingSummaryService {
  constructor(
    private readonly bookings: BookingsService,
    @InjectModel(Booking.name) private readonly bookingModel: Model<Booking>,
    @InjectModel(PaymentTransaction.name)
    private readonly payments: Model<PaymentTransaction>,
    @InjectModel(ServiceOrder.name)
    private readonly serviceOrders: Model<ServiceOrder>,
    private readonly invoices: InvoicesService,
  ) {}

  async get(
    id: string,
    ctx: { code?: string; user?: AuthUser },
  ): Promise<BookingSummaryResponse> {
    // Kiểm tra id, quyền đọc và hết hạn giữ phòng như GET /bookings/:id.
    await this.bookings.getBooking(id, ctx);

    const found = await this.bookingModel
      .findById(id)
      .populate<{ rooms: SummaryRoomDoc[] }>(BOOKING_ROOMS_POPULATE)
      .lean();
    if (!found) throw new NotFoundException('Không tìm thấy đơn đặt phòng.');
    // `timestamps: true` thêm createdAt khi lưu; kiểu của schema không khai báo nó.
    const booking = found as typeof found & { createdAt?: Date };

    const [invoice, payments, orders] = await Promise.all([
      // Tính lại để số liệu luôn khớp với thanh toán và phí hiện có.
      this.invoices.recalculate(id),
      this.payments
        .find({ booking: booking._id, isActive: true })
        .sort({ createdAt: 1 })
        .lean(),
      this.serviceOrders
        .find({ booking: booking._id })
        .sort({ createdAt: 1 })
        .lean(),
    ]);

    return {
      bookingId: String(booking._id),
      code: booking.code,
      status: booking.status,
      source: booking.source,
      // Đã liên kết tài khoản khách hàng chưa; để UI phân biệt khách có tài khoản với khách vãng lai.
      hasAccount: Boolean(booking.customer),
      checkIn: booking.checkIn.toISOString(),
      checkOut: booking.checkOut.toISOString(),
      adultCount: booking.adultCount,
      childCount: booking.childCount,
      createdAt: (booking.createdAt ?? booking.checkIn).toISOString(),
      depositAmount: booking.depositAmount,
      guest: {
        ...(booking.guestName ? { name: booking.guestName } : {}),
        ...(booking.guestEmail ? { email: booking.guestEmail } : {}),
        ...(booking.guestPhone ? { phone: booking.guestPhone } : {}),
      },
      rooms: booking.rooms.map((room) => ({
        ...(room.roomNumber ? { roomNumber: room.roomNumber } : {}),
        ...(room.roomType?.name ? { roomTypeName: room.roomType.name } : {}),
      })),
      invoice: {
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
      payments: payments.map((payment) => ({
        id: String(payment._id),
        method: payment.method,
        purpose: payment.purpose,
        status: payment.status,
        amount: payment.amount,
        date: (
          payment.paidAt ??
          (payment as { createdAt?: Date }).createdAt ??
          booking.createdAt ??
          booking.checkIn
        ).toISOString(),
      })),
      serviceOrders: orders.map((order) => ({
        id: String(order._id),
        serviceName: order.serviceName,
        quantity: order.quantity,
        amount: order.amount,
        status: serviceOrderStatus(order),
        requestedTime: order.requestedTime.toISOString(),
      })),
    };
  }
}
