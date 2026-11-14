import { ApiProperty } from '@nestjs/swagger';
import { InvoiceTotals } from '../../invoices/dto/checkout-charge.dto.js';

export class SummaryGuest {
  name?: string;
  email?: string;
  phone?: string;
}

export class SummaryRoom {
  roomNumber?: string;
  roomTypeName?: string;
}

export class SummaryPayment {
  id: string;
  @ApiProperty({ enum: ['VNPAY', 'CASH', 'CARD'] })
  method: string;
  @ApiProperty({ enum: ['DEPOSIT', 'FINAL'] })
  purpose: string;
  @ApiProperty({ enum: ['PENDING', 'SUCCESS', 'FAILED', 'CANCELLED'] })
  status: string;
  amount: number;
  /** Lúc thu tiền (nếu đã thu), ngược lại lúc tạo giao dịch. */
  date: string;
}

export class SummaryServiceOrder {
  id: string;
  serviceName: string;
  quantity: number;
  amount: number;
  @ApiProperty({ enum: ['PENDING', 'IN_PROGRESS', 'DONE', 'CANCELLED'] })
  status: string;
  requestedTime: string;
}

export class BookingSummaryResponse {
  bookingId: string;
  code: string;
  status: string;
  source: string;
  /** Booking đã liên kết với một tài khoản khách hàng (không còn là khách vãng lai). */
  hasAccount: boolean;
  checkIn: string;
  checkOut: string;
  adultCount: number;
  childCount: number;
  createdAt: string;
  /** Tiền cọc cần đóng (VND); số đã đóng nằm trong invoice.depositPaid. */
  depositAmount: number;
  guest: SummaryGuest;
  rooms: SummaryRoom[];
  invoice: InvoiceTotals;
  payments: SummaryPayment[];
  serviceOrders: SummaryServiceOrder[];
}
