// Test mẫu: chạy bằng `npx vitest run src/modules/invoices/vi-du-hoa-don.spec.ts`
import { describe, it, expect } from 'vitest';
import { calculateInvoice } from './invoice-calculator.js';
import { checkOutStatusError } from './check-out.core.js';
import { InvoiceStatus } from './schemas/invoice.schema.js';
import { BookingStatus } from '../../common/constants/booking-status.enum.js';
import {
  PaymentPurpose,
  PaymentStatus,
} from '../payments/schemas/payment-transaction.schema.js';

describe('Tính hóa đơn (calculateInvoice)', () => {
  it('UT-01: 1 phòng 500.000đ x 2 đêm, chưa trả gì thì còn nợ 1.000.000đ', () => {
    // Arrange: chuẩn bị dữ liệu đầu vào
    const input = {
      rooms: [{ rate: 500_000, units: 2 }],
      serviceCharges: [],
      approvedAdditionalCharges: [],
      discounts: [],
      taxes: [],
      payments: [],
    };

    // Act: gọi hàm cần test
    const invoice = calculateInvoice(input);

    // Assert: so sánh kết quả với mong đợi
    expect(invoice.roomTotal).toBe(1_000_000);
    expect(invoice.balanceDue).toBe(1_000_000);
    expect(invoice.status).toBe(InvoiceStatus.Unpaid);
  });

  it('UT-02: đã cọc 30% thành công thì dư nợ còn 70%', () => {
    const invoice = calculateInvoice({
      rooms: [{ rate: 500_000, units: 2 }],
      serviceCharges: [],
      approvedAdditionalCharges: [],
      discounts: [],
      taxes: [],
      payments: [
        {
          transactionRef: 'VNP-001',
          purpose: PaymentPurpose.Deposit,
          status: PaymentStatus.Success,
          amount: 300_000,
        },
      ],
    });

    expect(invoice.balanceDue).toBe(700_000);
  });

  it('UT-03: giao dịch thất bại không được trừ vào dư nợ', () => {
    const invoice = calculateInvoice({
      rooms: [{ rate: 500_000, units: 2 }],
      serviceCharges: [],
      approvedAdditionalCharges: [],
      discounts: [],
      taxes: [],
      payments: [
        {
          transactionRef: 'VNP-002',
          purpose: PaymentPurpose.Deposit,
          status: PaymentStatus.Failed,
          amount: 300_000,
        },
      ],
    });

    expect(invoice.balanceDue).toBe(1_000_000);
  });

  it('UT-04: số tiền âm phải báo lỗi', () => {
    expect(() =>
      calculateInvoice({
        rooms: [{ rate: -1, units: 1 }],
        serviceCharges: [],
        approvedAdditionalCharges: [],
        discounts: [],
        taxes: [],
        payments: [],
      }),
    ).toThrow();
  });
});

describe('Điều kiện check-out (checkOutStatusError)', () => {
  it('UT-05: khách đang ở (CHECKED_IN) thì được check-out', () => {
    expect(checkOutStatusError(BookingStatus.CheckedIn)).toBeNull();
  });

  it('UT-06: booking chưa nhận phòng thì không được check-out', () => {
    expect(checkOutStatusError(BookingStatus.Confirmed)).toBe(
      'The guest has not checked in yet',
    );
  });
});
