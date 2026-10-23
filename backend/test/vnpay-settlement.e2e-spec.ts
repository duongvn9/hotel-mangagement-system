import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import type { INestApplication } from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { createHmac } from 'node:crypto';
import { AppModule } from '../src/app.module.js';
import { Booking } from '../src/modules/bookings/schemas/booking.schema.js';
import { Invoice } from '../src/modules/invoices/schemas/invoice.schema.js';
import {
  PaymentPurpose,
  PaymentStatus,
  PaymentTransaction,
} from '../src/modules/payments/schemas/payment-transaction.schema.js';
import {
  VnpayService,
  VnpaySettlementPort,
  type ExpectedVnpayPayment,
} from '../src/modules/payments/vnpay.service.js';

const settings = {
  tmnCode: 'TESTCODE',
  hashSecret: 'fixture-secret',
  paymentUrl: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
  returnUrl: 'http://localhost/payment/return',
  ipnUrl: '',
};

// Xây dựng query callback VNPay hợp lệ (ký HMAC-SHA512) cho một payment đã biết.
function callback(
  txnRef: string,
  amountVnd: number,
  changes: Record<string, string | undefined> = {},
): string {
  const data: Record<string, string | undefined> = {
    vnp_Amount: String(amountVnd * 100),
    vnp_BankCode: 'NCB',
    vnp_OrderInfo: `HMS ${PaymentPurpose.Deposit} ${txnRef}`,
    vnp_PayDate: '20261023120000',
    vnp_ResponseCode: '00',
    vnp_TmnCode: settings.tmnCode,
    vnp_TransactionNo: '990001',
    vnp_TransactionStatus: '00',
    vnp_TxnRef: txnRef,
    ...changes,
  };
  const query = Object.keys(data)
    .sort()
    .filter((key) => data[key] !== undefined)
    .map(
      (key) => `${key}=${encodeURIComponent(data[key]!).replace(/%20/g, '+')}`,
    )
    .join('&');
  return `${query}&vnp_SecureHash=${createHmac('sha512', settings.hashSecret).update(query).digest('hex')}`;
}

describe('VNPay settlement persistence (e2e)', () => {
  let app: INestApplication;
  let vnpay: VnpayService;
  let settlement: VnpaySettlementPort;
  let bookings: Model<Booking>;
  let invoices: Model<Invoice>;
  let payments: Model<PaymentTransaction>;
  const bookingId = new Types.ObjectId();
  const invoiceId = new Types.ObjectId();

  const seed = async (txnRef: string) => {
    await bookings.create({
      _id: bookingId,
      code: `VNP-${txnRef}`,
      rooms: [new Types.ObjectId()],
      guestName: 'Settlement test',
      guestEmail: 'settle@example.test',
      guestPhone: '0900000000',
      checkIn: new Date('2026-10-23'),
      checkOut: new Date('2026-10-25'),
      guests: 2,
      roomTotal: 1000000,
      depositAmount: 300000,
      status: 'PENDING_DEPOSIT',
    });
    await invoices.create({
      _id: invoiceId,
      booking: bookingId,
      code: `INV-${txnRef}`,
      roomTotal: 1000000,
      totalAmount: 1000000,
      balanceDue: 1000000,
    });
    await payments.create({
      booking: bookingId,
      invoice: invoiceId,
      transactionRef: txnRef,
      method: 'VNPAY',
      purpose: 'DEPOSIT',
      status: 'PENDING',
      amount: 300000,
    });
  };

  const expected = async (txnRef: string): Promise<ExpectedVnpayPayment> => {
    const payment = await payments.findOne({ transactionRef: txnRef });
    return {
      payment: payment!.toObject(),
      booking: { id: String(bookingId), isActive: true },
      invoice: {
        id: String(invoiceId),
        bookingId: String(bookingId),
        isActive: true,
      },
    };
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(VnpayService)
      .useValue(
        new VnpayService({
          get: () => settings,
        } as never),
      )
      .compile();
    app = module.createNestApplication();
    await app.init();
    vnpay = app.get(VnpayService);
    settlement = app.get(VnpaySettlementPort);
    bookings = app.get(getModelToken(Booking.name));
    invoices = app.get(getModelToken(Invoice.name));
    payments = app.get(getModelToken(PaymentTransaction.name));
    await Promise.all([bookings.init(), invoices.init(), payments.init()]);
  });

  beforeEach(async () => {
    await payments.deleteMany({ booking: bookingId });
    await invoices.deleteMany({ booking: bookingId });
    await bookings.deleteMany({ _id: bookingId });
  });

  afterAll(async () => {
    await payments.deleteMany({ booking: bookingId });
    await invoices.deleteMany({ booking: bookingId });
    await bookings.deleteMany({ _id: bookingId });
    await app.close();
  });

  it('commits a successful deposit: records payment, confirms booking, reconciles invoice', async () => {
    const txnRef = `COMMIT${Date.now()}`;
    await seed(txnRef);
    const plan = vnpay.prepareIpn(
      callback(txnRef, 300000),
      await expected(txnRef),
    );
    expect(plan.action).toBe('compare-and-set');
    if (plan.action !== 'compare-and-set') return;

    expect(await settlement.commitAtomically(await expected(txnRef), plan)).toBe(
      'committed',
    );

    const payment = await payments.findOne({ transactionRef: txnRef });
    expect(payment?.status).toBe(PaymentStatus.Success);
    expect(payment?.providerTransactionRef).toBe('990001');
    expect(payment?.paidAt).toBeInstanceOf(Date);
    expect((await bookings.findById(bookingId))?.status).toBe('CONFIRMED');
    expect(await invoices.findById(invoiceId)).toMatchObject({
      depositPaid: 300000,
      finalPaid: 0,
      balanceDue: 700000,
      status: 'PARTIALLY_PAID',
    });
  });

  it('is idempotent: a replayed identical callback reports duplicate without double-counting', async () => {
    const txnRef = `DUP${Date.now()}`;
    await seed(txnRef);
    const plan = vnpay.prepareIpn(
      callback(txnRef, 300000),
      await expected(txnRef),
    );
    if (plan.action !== 'compare-and-set') throw new Error('expected CAS');
    expect(await settlement.commitAtomically(await expected(txnRef), plan)).toBe(
      'committed',
    );

    // Payment đã SUCCESS; prepareIpn trả 'duplicate' và settlement cũng báo duplicate.
    const replay = vnpay.prepareIpn(
      callback(txnRef, 300000),
      await expected(txnRef),
    );
    expect(replay.action).toBe('duplicate');
    expect(await invoices.findById(invoiceId)).toMatchObject({
      depositPaid: 300000,
      balanceDue: 700000,
    });
  });

  it('does not confirm booking on a failed settlement', async () => {
    const txnRef = `FAIL${Date.now()}`;
    await seed(txnRef);
    const raw = callback(txnRef, 300000, {
      vnp_ResponseCode: '24',
      vnp_TransactionStatus: '02',
      vnp_TransactionNo: '990002',
    });
    const plan = vnpay.prepareIpn(raw, await expected(txnRef));
    expect(plan.action).toBe('compare-and-set');
    if (plan.action !== 'compare-and-set') return;

    expect(await settlement.commitAtomically(await expected(txnRef), plan)).toBe(
      'committed',
    );
    const payment = await payments.findOne({ transactionRef: txnRef });
    expect(payment?.status).toBe(PaymentStatus.Cancelled);
    expect((await bookings.findById(bookingId))?.status).toBe('PENDING_DEPOSIT');
    expect((await invoices.findById(invoiceId))?.balanceDue).toBe(1000000);
  });

  it('reports conflict when the pending payment is already gone', async () => {
    const txnRef = `GONE${Date.now()}`;
    await seed(txnRef);
    const plan = vnpay.prepareIpn(
      callback(txnRef, 300000),
      await expected(txnRef),
    );
    if (plan.action !== 'compare-and-set') throw new Error('expected CAS');
    const snapshot = await expected(txnRef);
    // Một tiến trình khác đã settle payment với mã VNPay khác trước đó.
    await payments.updateOne(
      { transactionRef: txnRef },
      { $set: { status: 'SUCCESS', providerTransactionRef: '111111' } },
    );
    expect(await settlement.commitAtomically(snapshot, plan)).toBe('conflict');
  });
});
