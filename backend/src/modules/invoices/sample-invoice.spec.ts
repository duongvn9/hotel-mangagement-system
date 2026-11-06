// Sample unit test. Run with: `npx vitest run src/modules/invoices/sample-invoice.spec.ts`
import { describe, it, expect } from 'vitest';
import { calculateInvoice } from './invoice-calculator.js';
import { checkOutStatusError } from './check-out.core.js';
import { InvoiceStatus } from './schemas/invoice.schema.js';
import { BookingStatus } from '../../common/constants/booking-status.enum.js';
import {
  PaymentPurpose,
  PaymentStatus,
} from '../payments/schemas/payment-transaction.schema.js';

describe('calculateInvoice', () => {
  it('UT-01: 1 room at 500,000 VND x 2 nights with no payment leaves 1,000,000 VND due', () => {
    // Arrange: prepare the input
    const input = {
      rooms: [{ rate: 500_000, units: 2 }],
      serviceCharges: [],
      approvedAdditionalCharges: [],
      discounts: [],
      taxes: [],
      payments: [],
    };

    // Act: call the function under test
    const invoice = calculateInvoice(input);

    // Assert: compare the result with the expected values
    expect(invoice.roomTotal).toBe(1_000_000);
    expect(invoice.balanceDue).toBe(1_000_000);
    expect(invoice.status).toBe(InvoiceStatus.Unpaid);
  });

  it('UT-02: a successful 30% deposit leaves 70% due', () => {
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

  it('UT-03: a failed payment does not reduce the balance due', () => {
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

  it('UT-04: a negative amount throws an error', () => {
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

describe('checkOutStatusError', () => {
  it('UT-05: a CHECKED_IN booking can be checked out', () => {
    expect(checkOutStatusError(BookingStatus.CheckedIn)).toBeNull();
  });

  it('UT-06: a booking that is not checked in cannot be checked out', () => {
    expect(checkOutStatusError(BookingStatus.Confirmed)).toBe(
      'The guest has not checked in yet',
    );
  });
});
