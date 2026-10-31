import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import type { INestApplication } from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { AppModule } from '../src/app.module.js';
import {
  InvoicePricingAdapter,
  PersistedInvoiceChargesAdapter,
} from '../src/modules/invoices/invoice-adapters.js';
import { InvoicesService } from '../src/modules/invoices/invoices.service.js';
import { InvoiceChargeType } from '../src/modules/invoices/schemas/invoice-charge.schema.js';
import {
  Booking,
  BookingSchema,
} from '../src/modules/bookings/schemas/booking.schema.js';
import {
  Invoice,
  InvoiceSchema,
} from '../src/modules/invoices/schemas/invoice.schema.js';
import {
  PaymentTransaction,
  PaymentTransactionSchema,
} from '../src/modules/payments/schemas/payment-transaction.schema.js';

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
      adultCount: 2,
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
  it('ensures booking uniqueness in an empty autoIndex:false database and deduplicates charge retries', async () => {
    const connection = invoices.db.useDb(`invoice_idempotency_${id}`, {
      useCache: false,
    });
    try {
      const isolatedInvoices = connection.model(
        Invoice.name,
        InvoiceSchema.clone().set('autoIndex', false),
      );
      const isolatedBookings = connection.model(
        Booking.name,
        BookingSchema.clone().set('autoIndex', false),
      );
      const isolatedPayments = connection.model(
        PaymentTransaction.name,
        PaymentTransactionSchema.clone().set('autoIndex', false),
      );
      await Promise.all([
        isolatedInvoices.init(),
        isolatedBookings.init(),
        isolatedPayments.init(),
      ]);
      expect(await isolatedInvoices.countDocuments()).toBe(0);
      expect(
        (await isolatedInvoices.collection.indexes()).filter(
          (index) => index.unique,
        ),
      ).toHaveLength(0);
      await isolatedBookings.create((await bookings.findById(id))!.toObject());
      const isolatedService = new InvoicesService(
        isolatedInvoices,
        isolatedBookings,
        isolatedPayments,
        app.get(InvoicePricingAdapter),
        new PersistedInvoiceChargesAdapter(),
      );
      const results = await Promise.all(
        Array.from({ length: 8 }, () =>
          isolatedService.getOrCreateForBooking(String(id)),
        ),
      );
      expect(new Set(results.map((invoice) => String(invoice._id))).size).toBe(
        1,
      );
      expect(await isolatedInvoices.countDocuments({ booking: id })).toBe(1);
      expect(await isolatedInvoices.collection.indexes()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'booking_1',
            key: { booking: 1 },
            unique: true,
          }),
        ]),
      );
      await expect(
        isolatedInvoices.create({ booking: id, code: 'different-code' }),
      ).rejects.toMatchObject({ code: 11000 });
      const charge = {
        bookingId: String(id),
        type: InvoiceChargeType.Service,
        amount: 10000,
        reason: 'Laundry',
        sourceId: 'invoice-retry:1',
      };
      await Promise.all([
        isolatedService.addCharge(charge),
        isolatedService.addCharge(charge),
      ]);
      const retried = await isolatedService.addCharge(charge);
      expect(String(retried._id)).toBe(String(results[0]._id));
      expect(retried.charges).toHaveLength(1);
      expect(retried.serviceTotal).toBe(10000);
      expect(await isolatedInvoices.countDocuments({ booking: id })).toBe(1);
    } finally {
      await connection.dropDatabase();
      await invoices.db.removeDb(connection.name);
    }
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
