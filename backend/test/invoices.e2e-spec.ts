import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import type { INestApplication } from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { AppModule } from '../src/app.module.js';
import { InvoicePricingAdapter } from '../src/modules/invoices/invoice-adapters.js';
import { InvoicesService } from '../src/modules/invoices/invoices.service.js';
import { InvoiceChargeType } from '../src/modules/invoices/schemas/invoice-charge.schema.js';
import { Booking } from '../src/modules/bookings/schemas/booking.schema.js';
import { Invoice } from '../src/modules/invoices/schemas/invoice.schema.js';
import { PaymentTransaction } from '../src/modules/payments/schemas/payment-transaction.schema.js';

describe('H7 invoice persistence', () => {
  let app: INestApplication;
  let service: InvoicesService;
  let bookings: Model<Booking>;
  let invoices: Model<Invoice>;
  let payments: Model<PaymentTransaction>;
  const id = new Types.ObjectId();
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(InvoicePricingAdapter)
      .useValue({
        getRoomLines: async (booking: Booking) =>
          booking.rooms.map((room) => ({
            roomId: String(room),
            rate: 500000,
            units: 2,
          })),
      })
      .compile();
    app = module.createNestApplication();
    await app.init();
    service = app.get(InvoicesService);
    bookings = app.get(getModelToken(Booking.name));
    invoices = app.get(getModelToken(Invoice.name));
    payments = app.get(getModelToken(PaymentTransaction.name));
    await Promise.all([bookings.init(), invoices.init(), payments.init()]);
    await bookings.create({
      _id: id,
      code: `H7-${id}`,
      rooms: [new Types.ObjectId(), new Types.ObjectId()],
      guestName: 'Invoice test',
      guestEmail: 'h7@example.test',
      guestPhone: '0900000000',
      checkIn: new Date('2026-10-23'),
      checkOut: new Date('2026-10-25'),
      guests: 2,
      roomTotal: 0,
      depositAmount: 900000,
      status: 'CHECKED_IN',
    });
  });
  afterAll(async () => {
    await payments.deleteMany({ booking: id });
    await invoices.deleteMany({ booking: id });
    await bookings.deleteOne({ _id: id });
    await app.close();
  });
  it('creates one invoice under concurrent calls', async () => {
    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        service.getOrCreateForBooking(String(id)),
      ),
    );
    expect(new Set(results.map((invoice) => String(invoice._id))).size).toBe(1);
    expect(await invoices.countDocuments({ booking: id })).toBe(1);
    expect(results[0].roomTotal).toBe(2000000);
  });
  it('atomically saves concurrent distinct and duplicate charges without lost updates', async () => {
    const charge = {
      bookingId: String(id),
      type: InvoiceChargeType.Service,
      amount: 10000,
      reason: 'Laundry',
      sourceId: 'service-order:1',
    };
    await Promise.all([
      service.addCharge(charge),
      service.addCharge(charge),
      service.addCharge({ ...charge, sourceId: 'service-order:2' }),
    ]);
    const invoice = await service.recalculate(String(id));
    expect(invoice.charges).toHaveLength(2);
    expect(invoice.serviceTotal).toBe(20000);
    await invoice.validate();
  });
  it('counts successful deposits and final payments once, ignores pending and failed', async () => {
    const invoice = await service.getOrCreateForBooking(String(id));
    await payments.create([
      {
        booking: id,
        invoice: invoice._id,
        transactionRef: `H7-deposit-${id}`,
        method: 'CASH',
        purpose: 'DEPOSIT',
        status: 'SUCCESS',
        amount: 200000,
        paidAt: new Date(),
      },
      {
        booking: id,
        invoice: invoice._id,
        transactionRef: `H7-pending-${id}`,
        method: 'CASH',
        purpose: 'FINAL',
        status: 'PENDING',
        amount: 1820000,
      },
      {
        booking: id,
        invoice: invoice._id,
        transactionRef: `H7-failed-${id}`,
        method: 'CASH',
        purpose: 'FINAL',
        status: 'FAILED',
        amount: 1820000,
      },
    ]);
    expect(await service.recalculate(String(id))).toMatchObject({
      depositPaid: 200000,
      finalPaid: 0,
      balanceDue: 1820000,
      status: 'PARTIALLY_PAID',
    });
    await payments.create({
      booking: id,
      invoice: invoice._id,
      transactionRef: `H7-final-${id}`,
      method: 'CASH',
      purpose: 'FINAL',
      status: 'SUCCESS',
      amount: 1820000,
      paidAt: new Date(),
    });
    for (let i = 0; i < 2; i++) {
      expect(await service.recalculate(String(id))).toMatchObject({
        totalAmount: 2020000,
        depositPaid: 200000,
        finalPaid: 1820000,
        balanceDue: 0,
        status: 'PAID',
      });
    }
  });
});
