import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import type { INestApplication } from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { randomUUID } from 'node:crypto';
import {
  canonicalize,
  signVnpay,
} from '../src/modules/payments/vnpay.protocol.js';
import { VnpaySettlementPort } from '../src/modules/payments/vnpay.service.js';
import { AppModule } from '../src/app.module.js';
import { Booking } from '../src/modules/bookings/schemas/booking.schema.js';
import { Invoice } from '../src/modules/invoices/schemas/invoice.schema.js';
import { InvoiceChargeType } from '../src/modules/invoices/schemas/invoice-charge.schema.js';
import { InvoicesService } from '../src/modules/invoices/invoices.service.js';
import { CashPaymentService } from '../src/modules/invoices/cash-payment.service.js';
import { CheckOutService } from '../src/modules/invoices/check-out.service.js';
import { PaymentsService } from '../src/modules/payments/payments.service.js';
import { VnpayService } from '../src/modules/payments/vnpay.service.js';
import { PaymentTransaction } from '../src/modules/payments/schemas/payment-transaction.schema.js';
import { ServiceOrdersService } from '../src/modules/service-orders/service-orders.service.js';
import { ServiceOrder } from '../src/modules/service-orders/schemas/service-order.schema.js';
import { Role } from '../src/common/constants/role.enum.js';
import { withBookingFinancialOperation } from '../src/modules/bookings/booking-financial-operation.js';
import { assertTestDatabase } from './test-database.js';

function barrier() {
  let release!: () => void;
  let entered!: () => void;
  const reached = new Promise<void>((resolve) => (entered = resolve));
  const waiting = new Promise<void>((resolve) => (release = resolve));
  return {
    reached,
    release,
    wait: async () => {
      entered();
      await waiting;
    },
  };
}

describe('financial coordination on standalone MongoDB', () => {
  let app: INestApplication;
  let bookings: Model<Booking>;
  let invoices: Model<Invoice>;
  let payments: Model<PaymentTransaction>;
  let orders: Model<ServiceOrder>;
  let billing: InvoicesService;
  let cash: CashPaymentService;
  let checkout: CheckOutService;
  let online: PaymentsService;
  let reviews: ServiceOrdersService;
  let id: string;
  const customer = new Types.ObjectId();
  const staff = { id: String(new Types.ObjectId()), role: Role.Receptionist };
  const actor = { user: { id: String(customer), role: Role.Customer } };
  beforeAll(async () => {
    assertTestDatabase(process.env.MONGODB_URI);
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(VnpayService)
      .useValue(
        new VnpayService({
          get: () => ({
            tmnCode: 'TESTCODE',
            hashSecret: 'fixture-secret',
            paymentUrl: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
            returnUrl: 'http://localhost/payment/return',
            ipnUrl: '',
          }),
        } as never),
      )
      .compile();
    app = module.createNestApplication();
    await app.init();
    bookings = app.get(getModelToken(Booking.name));
    invoices = app.get(getModelToken(Invoice.name));
    payments = app.get(getModelToken(PaymentTransaction.name));
    orders = app.get(getModelToken(ServiceOrder.name));
    billing = app.get(InvoicesService);
    cash = app.get(CashPaymentService);
    checkout = app.get(CheckOutService);
    online = app.get(PaymentsService);
    reviews = app.get(ServiceOrdersService);
    await Promise.all([
      bookings.init(),
      invoices.init(),
      payments.init(),
      orders.init(),
    ]);
  }, 60000);
  beforeEach(async () => {
    const room = new Types.ObjectId();
    const booking = await bookings.create({
      code: randomUUID(),
      customer,
      rooms: [room],
      guestName: 'Financial fixture',
      guestEmail: 'financial@example.test',
      guestPhone: '0900000000',
      checkIn: new Date('2026-01-01'),
      checkOut: new Date('2026-01-02'),
      adultCount: 1,
      roomTotal: 100000,
      depositAmount: 0,
      status: 'CHECKED_IN',
      rateSnapshot: [{ room, ratePerNight: 100000 }],
    });
    id = String(booking._id);
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    await payments.deleteMany({ booking: new Types.ObjectId(id) });
    await invoices.deleteMany({ booking: new Types.ObjectId(id) });
    await orders.deleteMany({ booking: new Types.ObjectId(id) });
    await bookings.deleteOne({ _id: id });
  });
  afterAll(async () => {
    await app.close();
  });
  const charge = (amount = 20000) =>
    billing.addCharge({
      bookingId: id,
      type: InvoiceChargeType.Service,
      amount,
      reason: 'Financial test',
      sourceId: randomUUID(),
    });
  const order = () =>
    orders.create({
      booking: new Types.ObjectId(id),
      customer,
      service: new Types.ObjectId(),
      serviceName: 'Laundry',
      unit: 'kg',
      quantity: 1,
      unitPriceVND: 20000,
      amount: 20000,
      requestedTime: new Date(),
    });

  it('supports repeated FINAL cash topups with immutable amount and replay', async () => {
    const requestId = randomUUID();
    await cash.record(id, { requestId });
    await charge();
    await cash.record(id, { requestId: randomUUID() });
    await cash.record(id, { requestId });
    const rows = await payments
      .find({ booking: new Types.ObjectId(id) })
      .sort({ createdAt: 1 });
    expect(rows.map((row) => row.amount)).toEqual([100000, 20000]);
    rows[0].amount = 1;
    await rows[0].save();
    expect((await payments.findById(rows[0]._id))!.amount).toBe(100000);
    expect((await billing.recalculate(id)).balanceDue).toBe(0);
    await checkout.checkOut(id);
    await cash.record(id, { requestId });
    await expect(charge()).rejects.toThrow('closed booking');
  });

  it.each(['cash', 'vnpay'])(
    'barrier: %s admission excludes the other collector',
    async (first) => {
      const gate = barrier();
      const original = billing.recalculate.bind(billing);
      vi.spyOn(billing, 'recalculate').mockImplementationOnce(
        async (bookingId) => {
          const result = await original(bookingId);
          await gate.wait();
          return result;
        },
      );
      const cashCall = () => cash.record(id, { requestId: randomUUID() });
      const onlineCall = () =>
        online.initiateFinal(id, actor, { ipAddress: '127.0.0.1' });
      const winner = first === 'cash' ? cashCall() : onlineCall();
      await gate.reached;
      const loser = (first === 'cash' ? onlineCall() : cashCall()).then(
        () => 'unexpected',
        (error: Error) => error.message,
      );
      await new Promise((resolve) => setTimeout(resolve, 75));
      expect(
        await payments.countDocuments({ booking: new Types.ObjectId(id) }),
      ).toBe(0);
      gate.release();
      await winner;
      expect(await loser).not.toBe('unexpected');
      expect(
        await payments.countDocuments({ booking: new Types.ObjectId(id) }),
      ).toBe(1);
    },
  );

  it('barrier: concurrent cash requests cannot insert a loser SUCCESS', async () => {
    const gate = barrier();
    const original = billing.recalculate.bind(billing);
    vi.spyOn(billing, 'recalculate').mockImplementationOnce(
      async (bookingId) => {
        const result = await original(bookingId);
        await gate.wait();
        return result;
      },
    );
    const first = cash.record(id, { requestId: randomUUID() });
    await gate.reached;
    const second = cash
      .record(id, { requestId: randomUUID() })
      .catch((error: Error) => error.message);
    gate.release();
    await first;
    expect(await second).toContain('Nothing left');
    expect(
      await payments.countDocuments({
        booking: new Types.ObjectId(id),
        status: 'SUCCESS',
      }),
    ).toBe(1);
  });

  it('barrier: acceptance intent blocks checkout until durable billing is paid', async () => {
    await cash.record(id, { requestId: randomUUID() });
    const row = await order();
    const gate = barrier();
    const original = billing.addCharge.bind(billing);
    vi.spyOn(billing, 'addCharge').mockImplementationOnce(async (input) => {
      await gate.wait();
      return original(input);
    });
    const accept = reviews.review(
      String(row._id),
      { decision: 'ACCEPT' },
      staff,
    );
    await gate.reached;
    expect((await bookings.findById(id))!.acceptanceReservations).toEqual([
      String(row._id),
    ]);
    const close = checkout.checkOut(id).then(
      () => 'unexpected',
      (error: Error) => error.message,
    );
    gate.release();
    await accept;
    expect(await close).toContain('still due');
    expect((await bookings.findById(id))!.status).toBe('CHECKED_IN');
    await cash.record(id, { requestId: randomUUID() });
    await checkout.checkOut(id);
  });

  it('barrier: checkout admission denies later acceptance without creating intent or charge', async () => {
    await cash.record(id, { requestId: randomUUID() });
    const row = await order();
    const gate = barrier();
    const original = billing.recalculate.bind(billing);
    vi.spyOn(billing, 'recalculate').mockImplementationOnce(
      async (bookingId) => {
        const result = await original(bookingId);
        await gate.wait();
        return result;
      },
    );
    const close = checkout.checkOut(id);
    await gate.reached;
    const accept = reviews
      .review(String(row._id), { decision: 'ACCEPT' }, staff)
      .then(
        () => 'unexpected',
        (error: Error) => error.message,
      );
    gate.release();
    await close;
    expect(await accept).toContain('CHECKED_IN');
    expect((await orders.findById(row._id))!.reviewStatus).toBe(
      'PENDING_REVIEW',
    );
    expect(
      (await invoices.findOne({ booking: new Types.ObjectId(id) }))!.charges,
    ).toHaveLength(0);
  });

  it('preserves reservation on billing failure and retries the exact intent', async () => {
    await cash.record(id, { requestId: randomUUID() });
    const row = await order();
    vi.spyOn(billing, 'addCharge').mockRejectedValueOnce(
      new Error('simulated crash before billing'),
    );
    await expect(
      reviews.review(String(row._id), { decision: 'ACCEPT' }, staff),
    ).rejects.toThrow();
    expect(
      (await bookings.findById(id))!.financialOperationToken,
    ).toBeUndefined();
    expect((await bookings.findById(id))!.acceptanceReservations).toEqual([
      String(row._id),
    ]);
    await expect(checkout.checkOut(id)).rejects.toThrow('billing is pending');
    await reviews.review(String(row._id), { decision: 'ACCEPT' }, staff);
    expect((await bookings.findById(id))!.acceptanceReservations).toEqual([]);
    expect((await billing.recalculate(id)).balanceDue).toBe(20000);
  });

  it('blocks legacy ACCEPTING without reservation and repairs persisted charge after closure', async () => {
    await cash.record(id, { requestId: randomUUID() });
    const row = await order();
    await orders.updateOne(
      { _id: row._id },
      {
        $set: {
          reviewStatus: 'ACCEPTING',
          reviewDecision: 'ACCEPT',
          reviewReason: '',
          reviewedBy: staff.id,
          reviewedAt: new Date(),
        },
      },
    );
    await expect(checkout.checkOut(id)).rejects.toThrow('billing is pending');
    await reviews.review(String(row._id), { decision: 'ACCEPT' }, staff);
    await cash.record(id, { requestId: randomUUID() });
    await checkout.checkOut(id);
    await orders.updateOne(
      { _id: row._id },
      {
        $set: { reviewStatus: 'ACCEPTING' },
        $unset: { billedInvoiceId: 1, billedAt: 1 },
      },
    );
    await reviews.review(String(row._id), { decision: 'ACCEPT' }, staff);
    expect(
      (await invoices.findOne({ booking: new Types.ObjectId(id) }))!.charges,
    ).toHaveLength(1);
  });

  it('repeated VNPay FINAL topups, concurrent duplicate IPNs and durable effect repair', async () => {
    const callback = (
      transactionRef: string,
      amount: number,
      provider: string,
    ) => {
      const data = {
        vnp_Amount: String(amount * 100),
        vnp_BankCode: 'NCB',
        vnp_OrderInfo: `HMS FINAL ${transactionRef}`,
        vnp_PayDate: '20261023120000',
        vnp_ResponseCode: '00',
        vnp_TmnCode: 'TESTCODE',
        vnp_TransactionNo: provider,
        vnp_TransactionStatus: '00',
        vnp_TxnRef: transactionRef,
      };
      return `${canonicalize(data)}&vnp_SecureHash=${signVnpay(data, 'fixture-secret')}`;
    };
    const first = await online.initiateFinal(id, actor, {
      ipAddress: '127.0.0.1',
    });
    const raw = callback(first.transactionRef, first.amount, '881001');
    const gate = barrier();
    const adapter = app.get(VnpaySettlementPort);
    const internals = adapter as unknown as {
      reconcileInvoice: (...args: unknown[]) => Promise<void>;
    };
    const original = internals.reconcileInvoice.bind(adapter);
    vi.spyOn(internals, 'reconcileInvoice').mockImplementationOnce(
      async (...args) => {
        await gate.wait();
        return original(...args);
      },
    );
    const settle = online.processIpn(raw);
    await gate.reached;
    const duplicate = online.processIpn(raw);
    const concurrentCharge = charge();
    gate.release();
    expect((await settle).RspCode).toBe('00');
    expect((await duplicate).RspCode).toBe('02');
    await concurrentCharge;
    expect((await billing.recalculate(id)).balanceDue).toBe(20000);
    const second = await online.initiateFinal(id, actor, {
      ipAddress: '127.0.0.1',
    });
    expect(second.amount).toBe(20000);
    vi.spyOn(internals, 'reconcileInvoice').mockRejectedValueOnce(
      new Error('crash after payment CAS'),
    );
    const nextRaw = callback(second.transactionRef, second.amount, '881002');
    expect((await online.processIpn(nextRaw)).RspCode).toBe('99');
    expect((await online.processIpn(nextRaw)).RspCode).toBe('02');
    expect(
      (await invoices.findOne({ booking: new Types.ObjectId(id) }))!.balanceDue,
    ).toBe(0);
    expect(
      await payments.countDocuments({
        booking: new Types.ObjectId(id),
        status: 'SUCCESS',
      }),
    ).toBe(2);
    await checkout.checkOut(id);
  });

  it('audits legacy unbilled acceptance after closure without adding new debt', async () => {
    await cash.record(id, { requestId: randomUUID() });
    await checkout.checkOut(id);
    const row = await order();
    await orders.updateOne(
      { _id: row._id },
      {
        $set: {
          reviewStatus: 'ACCEPTING',
          reviewDecision: 'ACCEPT',
          reviewReason: '',
          reviewedBy: staff.id,
          reviewedAt: new Date(),
        },
      },
    );
    await expect(
      reviews.review(String(row._id), { decision: 'ACCEPT' }, staff),
    ).rejects.toThrow('requires reconciliation');
    expect(
      (await bookings.findById(id))!.financialReconciliationOrderIds,
    ).toEqual([String(row._id)]);
    expect(
      (await invoices.findOne({ booking: new Types.ObjectId(id) }))!.charges,
    ).toHaveLength(0);
  });

  it('normalizes uppercase booking IDs before nested gate ownership checks', async () => {
    await withBookingFinancialOperation(
      bookings,
      id.toUpperCase(),
      async () => {
        await withBookingFinancialOperation(bookings, id, async () => {
          await charge();
        });
      },
    );
    expect((await billing.recalculate(id)).balanceDue).toBe(120000);
  });

  it('cash replay repairs a successful insert when the response recalculation failed', async () => {
    const requestId = randomUUID();
    const original = billing.recalculate.bind(billing);
    vi.spyOn(billing, 'recalculate')
      .mockImplementationOnce(original)
      .mockRejectedValueOnce(new Error('response calculation interrupted'));
    await expect(cash.record(id, { requestId })).rejects.toThrow('interrupted');
    expect(
      await payments.countDocuments({
        booking: new Types.ObjectId(id),
        status: 'SUCCESS',
      }),
    ).toBe(1);
    const replay = await cash.record(id, { requestId });
    expect(replay.totals.balanceDue).toBe(0);
    expect(
      await payments.countDocuments({ booking: new Types.ObjectId(id) }),
    ).toBe(1);
  });

  it('acceptance replay repairs reservation cleanup failure after durable finalization', async () => {
    const row = await order();
    const original = bookings.updateOne.bind(bookings);
    vi.spyOn(bookings, 'updateOne').mockImplementation(((
      filter: unknown,
      update: Record<string, unknown>,
      options: unknown,
    ) => {
      if (update.$pull) {
        vi.mocked(bookings.updateOne).mockImplementation(original);
        return Promise.reject(new Error('reservation cleanup interrupted'));
      }
      return original(filter as never, update, options as never);
    }) as typeof bookings.updateOne);
    await expect(
      reviews.review(String(row._id), { decision: 'ACCEPT' }, staff),
    ).rejects.toThrow();
    expect((await orders.findById(row._id))!.reviewStatus).toBe('ACCEPTED');
    expect((await bookings.findById(id))!.acceptanceReservations).toEqual([
      String(row._id),
    ]);
    await expect(checkout.checkOut(id)).rejects.toThrow('billing is pending');
    await reviews.review(String(row._id), { decision: 'ACCEPT' }, staff);
    expect((await bookings.findById(id))!.acceptanceReservations).toEqual([]);
    expect(
      (await invoices.findOne({ booking: new Types.ObjectId(id) }))!.charges,
    ).toHaveLength(1);
  });

  it.each([
    'CHECKED_OUT',
    'EXPIRED',
    'PENDING_DEPOSIT',
    'CANCELLED',
    'ROOM_HELD',
  ])('rejects FINAL admission for %s', async (status) => {
    await bookings.updateOne({ _id: id }, { $set: { status } });
    await expect(
      online.initiateFinal(id, actor, { ipAddress: '127.0.0.1' }),
    ).rejects.toThrow('not ready');
    expect(
      await payments.countDocuments({ booking: new Types.ObjectId(id) }),
    ).toBe(0);
  });

  it('never steals a crashed gate and cannot release another owner token', async () => {
    await bookings.updateOne(
      { _id: id },
      {
        $set: {
          financialOperationToken: 'crashed',
          financialOperationStartedAt: new Date(0),
        },
      },
    );
    await expect(
      withBookingFinancialOperation(bookings, id, async () => undefined),
    ).rejects.toThrow('in progress');
    expect((await bookings.findById(id))!.financialOperationToken).toBe(
      'crashed',
    );
    await bookings.updateOne(
      { _id: id, financialOperationToken: 'crashed' },
      { $unset: { financialOperationToken: 1 } },
    );
    await withBookingFinancialOperation(bookings, id, async () => {
      await bookings.updateOne(
        { _id: id },
        { $set: { financialOperationToken: 'replacement' } },
      );
    });
    expect((await bookings.findById(id))!.financialOperationToken).toBe(
      'replacement',
    );
  });
});
