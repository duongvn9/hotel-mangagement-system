import { ConflictException } from '@nestjs/common';
import { Types } from 'mongoose';
import { BookingStatus } from '../bookings/schemas/booking.schema.js';
import {
  PaymentMethod,
  PaymentPurpose,
  PaymentStatus,
} from '../payments/schemas/payment-transaction.schema.js';
import { CashPaymentService } from './cash-payment.service.js';

const bookingId = new Types.ObjectId();
const invoiceId = new Types.ObjectId();

function setup(
  existing?: Record<string, unknown>,
  confirmed: Date | null = new Date('2026-11-10T04:00:00Z'),
) {
  const booking = {
    _id: bookingId,
    code: 'GE-123',
    status: BookingStatus.CheckedIn,
    isActive: true,
    checkoutFeesConfirmedAt: confirmed ?? undefined,
  };
  const bookings = {
    findById: vi.fn(async () => booking),
    updateOne: vi.fn(async () => ({ modifiedCount: 1 })),
    exists: vi.fn(async () => ({ _id: bookingId })),
  };
  const payments = {
    findOne: vi.fn(async () => existing ?? null),
    exists: vi.fn(async () => null),
    create: vi.fn(async () => ({})),
    updateMany: vi.fn(async () => ({ modifiedCount: 1 })),
  };
  const invoice = {
    _id: invoiceId,
    status: 'PARTIALLY_PAID',
    roomTotal: 0,
    serviceTotal: 0,
    additionalTotal: 0,
    discountTotal: 0,
    taxTotal: 0,
    totalAmount: 1_400_000,
    depositPaid: 0,
    finalPaid: 0,
    balanceDue: 1_400_000,
    charges: [],
  };
  const invoices = { recalculate: vi.fn(async () => invoice) };
  const sut = new CashPaymentService(
    bookings as never,
    payments as never,
    invoices as never,
  );
  return { sut, payments };
}

const dto = { requestId: 'req-12345678' };

describe('CashPaymentService desk payments', () => {
  it('records cash by default with a CASH reference', async () => {
    const { sut, payments } = setup();

    await sut.record(bookingId.toHexString(), dto);

    expect(payments.create).toHaveBeenCalledWith(
      expect.objectContaining({
        method: PaymentMethod.Cash,
        transactionRef: 'CASH-req-12345678',
        purpose: PaymentPurpose.Final,
        status: PaymentStatus.Success,
        amount: 1_400_000,
      }),
    );
  });

  it('records a card payment for the amount still due', async () => {
    const { sut, payments } = setup();

    await sut.record(bookingId.toHexString(), dto, PaymentMethod.Card);

    expect(payments.create).toHaveBeenCalledWith(
      expect.objectContaining({
        method: PaymentMethod.Card,
        transactionRef: 'CARD-req-12345678',
        purpose: PaymentPurpose.Final,
        status: PaymentStatus.Success,
        amount: 1_400_000,
      }),
    );
  });

  it('refuses a card request id that was already used for another payment', async () => {
    const { sut } = setup({
      booking: bookingId,
      method: PaymentMethod.Cash,
      purpose: PaymentPurpose.Final,
      status: PaymentStatus.Success,
    });

    await expect(
      sut.record(bookingId.toHexString(), dto, PaymentMethod.Card),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('cancels a pending VNPay final payment with supersededAt so desk payment can proceed', async () => {
    const { sut, payments } = setup();

    const response = await sut.cancelPendingVnpay(bookingId.toHexString());

    expect(payments.updateMany).toHaveBeenCalledWith(
      {
        booking: bookingId,
        purpose: PaymentPurpose.Final,
        method: PaymentMethod.Vnpay,
        status: PaymentStatus.Pending,
        isActive: true,
      },
      {
        $set: {
          status: PaymentStatus.Cancelled,
          supersededAt: expect.any(Date),
        },
      },
    );
    expect(response.bookingId).toBe(bookingId.toHexString());
  });
});

describe('CashPaymentService fee confirmation gate', () => {
  it.each([PaymentMethod.Cash, PaymentMethod.Card] as const)(
    'refuses %s while the guest has not confirmed the fees',
    async (method) => {
      const { sut, payments } = setup(undefined, null);

      await expect(
        sut.record(bookingId.toHexString(), dto, method),
      ).rejects.toThrow('confirmed the fees');
      expect(payments.create).not.toHaveBeenCalled();
    },
  );

  it('does not block a replay of a payment that was already taken', async () => {
    const { sut } = setup(
      {
        booking: bookingId,
        method: PaymentMethod.Cash,
        purpose: PaymentPurpose.Final,
        status: PaymentStatus.Success,
      },
      null,
    );

    await expect(
      sut.record(bookingId.toHexString(), dto),
    ).resolves.toBeDefined();
  });
});
