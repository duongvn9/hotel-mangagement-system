import { ConflictException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { BookingStatus } from '../bookings/schemas/booking.schema.js';
import {
  PaymentMethod,
  PaymentPurpose,
  PaymentStatus,
} from '../payments/schemas/payment-transaction.schema.js';
import { DeskDepositService } from './desk-deposit.service.js';

const bookingId = new Types.ObjectId();
const invoiceId = new Types.ObjectId();
const dto = { requestId: 'req-12345678' };

function setup(
  options: {
    status?: BookingStatus;
    depositAmount?: number;
    replay?: Record<string, unknown>;
    settled?: boolean;
    pending?: boolean;
    missing?: boolean;
  } = {},
) {
  const booking = {
    _id: bookingId,
    code: 'GE-1',
    status: options.status ?? BookingStatus.Confirmed,
    depositAmount: options.depositAmount ?? 170_000,
    isActive: true,
  };
  const bookings = {
    findById: vi.fn(async () => (options.missing ? null : booking)),
    updateOne: vi.fn(async () => ({ modifiedCount: 1 })),
    exists: vi.fn(async () => ({ _id: bookingId })),
  };
  const payments = {
    findOne: vi.fn(async () => options.replay ?? null),
    exists: vi.fn(async (filter: { status?: string }) =>
      filter.status === PaymentStatus.Success
        ? options.settled
          ? { _id: 1 }
          : null
        : options.pending
          ? { _id: 1 }
          : null,
    ),
    create: vi.fn(async () => ({})),
  };
  const invoice = {
    _id: invoiceId,
    status: 'PARTIALLY_PAID',
    roomTotal: 1_700_000,
    serviceTotal: 0,
    additionalTotal: 0,
    discountTotal: 0,
    taxTotal: 0,
    totalAmount: 1_700_000,
    depositPaid: 170_000,
    finalPaid: 0,
    balanceDue: 1_530_000,
    charges: [],
  };
  const invoices = {
    getOrCreateForBooking: vi.fn(async () => invoice),
    recalculate: vi.fn(async () => invoice),
  };
  const sut = new DeskDepositService(
    bookings as never,
    payments as never,
    invoices as never,
  );
  return { sut, payments, invoices };
}

describe('DeskDepositService', () => {
  it.each([PaymentMethod.Cash, PaymentMethod.Card] as const)(
    'records the booking deposit as a %s payment',
    async (method) => {
      const { sut, payments } = setup();

      const result = await sut.record(bookingId.toHexString(), dto, method);

      expect(payments.create).toHaveBeenCalledWith(
        expect.objectContaining({
          method,
          purpose: PaymentPurpose.Deposit,
          status: PaymentStatus.Success,
          amount: 170_000,
          transactionRef: `DEPOSIT-${method}-req-12345678`,
        }),
      );
      expect(result.totals.depositPaid).toBe(170_000);
    },
  );

  it('only takes a deposit at the desk for a confirmed booking', async () => {
    for (const status of [
      BookingStatus.PendingDeposit,
      BookingStatus.CheckedIn,
      BookingStatus.Cancelled,
    ]) {
      const { sut, payments } = setup({ status });
      await expect(
        sut.record(bookingId.toHexString(), dto, PaymentMethod.Cash),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(payments.create).not.toHaveBeenCalled();
    }
  });

  it('refuses a second deposit and a deposit while VNPay is pending', async () => {
    for (const options of [{ settled: true }, { pending: true }]) {
      const { sut, payments } = setup(options);
      await expect(
        sut.record(bookingId.toHexString(), dto, PaymentMethod.Cash),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(payments.create).not.toHaveBeenCalled();
    }
  });

  it('returns 404 for an unknown booking', async () => {
    const { sut } = setup({ missing: true });
    await expect(
      sut.record(bookingId.toHexString(), dto, PaymentMethod.Cash),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('replays the same request without a second payment', async () => {
    const { sut, payments } = setup({
      replay: {
        booking: bookingId,
        method: PaymentMethod.Cash,
        purpose: PaymentPurpose.Deposit,
        status: PaymentStatus.Success,
      },
    });

    await expect(
      sut.record(bookingId.toHexString(), dto, PaymentMethod.Cash),
    ).resolves.toBeDefined();
    expect(payments.create).not.toHaveBeenCalled();
  });

  it('refuses a request id already used for another kind of payment', async () => {
    const { sut } = setup({
      replay: {
        booking: bookingId,
        method: PaymentMethod.Cash,
        purpose: PaymentPurpose.Final,
        status: PaymentStatus.Success,
      },
    });

    await expect(
      sut.record(bookingId.toHexString(), dto, PaymentMethod.Cash),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('refuses a booking that has no deposit to take', async () => {
    const { sut, payments } = setup({ depositAmount: 0 });
    await expect(
      sut.record(bookingId.toHexString(), dto, PaymentMethod.Cash),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(payments.create).not.toHaveBeenCalled();
  });
});
