import { ForbiddenException } from '@nestjs/common';
import { Types } from 'mongoose';
import {
  PaymentMethod,
  PaymentPurpose,
  PaymentStatus,
} from '../payments/schemas/payment-transaction.schema.js';
import {
  ServiceOrderExecutionStatus,
  ServiceOrderReviewStatus,
} from '../service-orders/service-order-status.js';
import { BookingSummaryService } from './booking-summary.service.js';

const bookingId = new Types.ObjectId();
const roomId = new Types.ObjectId();
const ctx = { code: 'GE-1' };

const booking = {
  _id: bookingId,
  code: 'GE-1',
  status: 'CONFIRMED',
  source: 'FRONT_DESK',
  guestName: 'Khoa Nguyen',
  guestEmail: 'khoa@example.test',
  guestPhone: '0911111111',
  rooms: [{ _id: roomId, roomNumber: '102', roomType: { name: 'Standard' } }],
  checkIn: new Date('2026-11-10T07:00:00Z'),
  checkOut: new Date('2026-11-12T05:00:00Z'),
  adultCount: 2,
  childCount: 1,
  roomTotal: 1_700_000,
  depositAmount: 170_000,
  createdAt: new Date('2026-11-09T01:00:00Z'),
};

const invoice = {
  roomTotal: 1_700_000,
  serviceTotal: 430_000,
  additionalTotal: 0,
  discountTotal: 0,
  taxTotal: 0,
  totalAmount: 2_130_000,
  depositPaid: 170_000,
  finalPaid: 0,
  balanceDue: 1_960_000,
};

function order(
  review: ServiceOrderReviewStatus,
  execution: ServiceOrderExecutionStatus,
  name: string,
) {
  return {
    _id: new Types.ObjectId(),
    serviceName: name,
    quantity: 2,
    amount: 280_000,
    requestedTime: new Date('2026-11-10T09:00:00Z'),
    reviewStatus: review,
    executionStatus: execution,
  };
}

function setup(
  options: {
    forbidden?: boolean;
    payments?: unknown[];
    orders?: unknown[];
    customer?: Types.ObjectId;
  } = {},
) {
  const bookings = {
    getBooking: vi.fn(async () => {
      if (options.forbidden) throw new ForbiddenException();
      return {};
    }),
  };
  const loaded = options.customer
    ? { ...booking, customer: options.customer }
    : booking;
  const bookingModel = {
    findById: vi.fn(() => ({
      populate: () => ({ lean: async () => loaded }),
    })),
  };
  const payments = {
    find: vi.fn(() => ({
      sort: () => ({ lean: async () => options.payments ?? [] }),
    })),
  };
  const serviceOrders = {
    find: vi.fn(() => ({
      sort: () => ({ lean: async () => options.orders ?? [] }),
    })),
  };
  const invoices = { recalculate: vi.fn(async () => invoice) };
  const sut = new BookingSummaryService(
    bookings as never,
    bookingModel as never,
    payments as never,
    serviceOrders as never,
    invoices as never,
  );
  return { sut, bookings, payments, serviceOrders };
}

describe('BookingSummaryService', () => {
  it('returns the stay, guest, rooms and invoice totals of the booking', async () => {
    const { sut } = setup();

    const summary = await sut.get(bookingId.toHexString(), ctx);

    expect(summary).toMatchObject({
      bookingId: bookingId.toHexString(),
      code: 'GE-1',
      status: 'CONFIRMED',
      source: 'FRONT_DESK',
      guest: {
        name: 'Khoa Nguyen',
        email: 'khoa@example.test',
        phone: '0911111111',
      },
      rooms: [{ roomNumber: '102', roomTypeName: 'Standard' }],
      checkIn: '2026-11-10T07:00:00.000Z',
      checkOut: '2026-11-12T05:00:00.000Z',
      adultCount: 2,
      childCount: 1,
      createdAt: '2026-11-09T01:00:00.000Z',
      depositAmount: 170_000,
      invoice: { serviceTotal: 430_000, depositPaid: 170_000 },
    });
  });

  it('marks a booking with no linked account as not having one', async () => {
    const { sut } = setup();

    const summary = await sut.get(bookingId.toHexString(), ctx);

    expect(summary.hasAccount).toBe(false);
  });

  it('marks a booking linked to a customer account as having one', async () => {
    const { sut } = setup({ customer: new Types.ObjectId() });

    const summary = await sut.get(bookingId.toHexString(), ctx);

    expect(summary.hasAccount).toBe(true);
  });

  it('authorizes through the booking read rule before loading anything', async () => {
    const { sut, bookings, payments, serviceOrders } = setup({
      forbidden: true,
    });

    await expect(sut.get(bookingId.toHexString(), ctx)).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    expect(bookings.getBooking).toHaveBeenCalledWith(
      bookingId.toHexString(),
      ctx,
    );
    expect(payments.find).not.toHaveBeenCalled();
    expect(serviceOrders.find).not.toHaveBeenCalled();
  });

  it('lists the payments with method, purpose, status and amount', async () => {
    const paymentId = new Types.ObjectId();
    const { sut } = setup({
      payments: [
        {
          _id: paymentId,
          method: PaymentMethod.Cash,
          purpose: PaymentPurpose.Deposit,
          status: PaymentStatus.Success,
          amount: 170_000,
          paidAt: new Date('2026-11-09T02:00:00Z'),
          createdAt: new Date('2026-11-09T02:00:00Z'),
          transactionRef: 'DEPOSIT-CASH-abc',
        },
      ],
    });

    const summary = await sut.get(bookingId.toHexString(), ctx);

    expect(summary.payments).toEqual([
      {
        id: paymentId.toHexString(),
        method: 'CASH',
        purpose: 'DEPOSIT',
        status: 'SUCCESS',
        amount: 170_000,
        date: '2026-11-09T02:00:00.000Z',
      },
    ]);
  });

  it('only reads the booking’s own active payments and service orders', async () => {
    const { sut, payments, serviceOrders } = setup();

    await sut.get(bookingId.toHexString(), ctx);

    expect(payments.find).toHaveBeenCalledWith({
      booking: bookingId,
      isActive: true,
    });
    expect(serviceOrders.find).toHaveBeenCalledWith({ booking: bookingId });
  });

  it('shows an abandoned acceptance as cancelled without changing charges or pending orders', async () => {
    const abandoned = {
      ...order(
        ServiceOrderReviewStatus.Abandoned,
        ServiceOrderExecutionStatus.NotStarted,
        'Giặt ủi',
      ),
      unitPriceVND: 0,
      amount: 0,
      reviewDecision: 'ACCEPT',
      acceptanceRecovery: {
        decision: 'REJECT',
        action: 'ABANDON_EXPIRED',
        reason: 'Verified no charge or work',
        rejectionReason: 'Appointment missed',
        actor: new Types.ObjectId(),
        actorRole: 'RECEPTIONIST',
        at: new Date('2026-11-11T09:00:00Z'),
        previousReviewStatus: 'ACCEPTING',
        resultingReviewStatus: 'ABANDONED',
        evidence: {
          chargeExpected: false,
          sourceChargeAbsent: true,
          taskAbsent: true,
        },
      },
    };
    const pending = order(
      ServiceOrderReviewStatus.PendingReview,
      ServiceOrderExecutionStatus.NotStarted,
      'Ăn sáng',
    );
    const original = structuredClone(abandoned);
    const { sut } = setup({ orders: [abandoned, pending] });

    const summary = await sut.get(bookingId.toHexString(), ctx);

    expect(summary.serviceOrders).toEqual([
      {
        id: abandoned._id.toHexString(),
        serviceName: abandoned.serviceName,
        quantity: abandoned.quantity,
        amount: 0,
        status: 'CANCELLED',
        requestedTime: abandoned.requestedTime.toISOString(),
      },
      {
        id: pending._id.toHexString(),
        serviceName: pending.serviceName,
        quantity: pending.quantity,
        amount: pending.amount,
        status: 'PENDING',
        requestedTime: pending.requestedTime.toISOString(),
      },
    ]);
    expect(summary.invoice).toEqual(invoice);
    expect(summary.payments).toEqual([]);
    expect(structuredClone(abandoned)).toEqual(original);
  });

  it.each([
    [
      ServiceOrderReviewStatus.PendingReview,
      ServiceOrderExecutionStatus.NotStarted,
      'PENDING',
    ],
    [
      ServiceOrderReviewStatus.Accepted,
      ServiceOrderExecutionStatus.Assigned,
      'PENDING',
    ],
    [
      ServiceOrderReviewStatus.Accepted,
      ServiceOrderExecutionStatus.InProgress,
      'IN_PROGRESS',
    ],
    [
      ServiceOrderReviewStatus.Accepted,
      ServiceOrderExecutionStatus.Completed,
      'DONE',
    ],
    [
      ServiceOrderReviewStatus.Rejected,
      ServiceOrderExecutionStatus.NotStarted,
      'CANCELLED',
    ],
  ])(
    'shows a service order that is %s / %s as %s',
    async (review, execution, expected) => {
      const { sut } = setup({ orders: [order(review, execution, 'Giặt ủi')] });

      const summary = await sut.get(bookingId.toHexString(), ctx);

      expect(summary.serviceOrders).toEqual([
        expect.objectContaining({
          serviceName: 'Giặt ủi',
          quantity: 2,
          amount: 280_000,
          status: expected,
        }),
      ]);
    },
  );
});
