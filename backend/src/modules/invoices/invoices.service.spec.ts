import { Model, Types, model } from 'mongoose';
import { Invoice, InvoiceSchema } from './schemas/invoice.schema.js';
import { Booking, BookingSchema, BookingStatus } from '../bookings/schemas/booking.schema.js';
import { PaymentTransaction, PaymentTransactionSchema } from '../payments/schemas/payment-transaction.schema.js';
import { InvoicesService } from './invoices.service.js';
import { PersistedInvoiceChargesAdapter, UnavailableInvoicePricingAdapter } from './invoice-adapters.js';
import { InvoiceChargeType } from './schemas/invoice-charge.schema.js';

const InvoiceModel = model('H7UnitInvoice', InvoiceSchema);
const BookingModel = model('H7UnitBooking', BookingSchema);
const PaymentModel = model('H7UnitPayment', PaymentTransactionSchema);
function setup() {
  const room = new Types.ObjectId();
  const booking = new BookingModel({ rooms: [room], isActive: true, status: BookingStatus.CheckedIn });
  let stored: Record<string, unknown> | undefined;
  let versionFailures = 0;
  const save = vi.fn(async function (this: InstanceType<typeof InvoiceModel>) {
    await this.validate();
    if (versionFailures-- > 0) throw Object.assign(new Error('retry'), { name: 'VersionError' });
    stored = this.toObject();
    return this;
  });
  const hydrate = (data: object) => {
    const doc = new InvoiceModel(data);
    doc.save = save.bind(doc) as typeof doc.save;
    return doc;
  };
  const invoices = Object.assign(function (data: object) { return hydrate(data); }, {
    findOne: vi.fn(async () => stored ? hydrate(stored) : null), init: vi.fn(async () => undefined),
  });
  const bookings = { findById: vi.fn(async () => booking) };
  const payments = { find: vi.fn(async () => [] as InstanceType<typeof PaymentModel>[]) };
  const pricing = { getRoomLines: vi.fn(async () => [{ roomId: String(room), rate: 500000, units: 2 }]) };
  const service = new InvoicesService(invoices as unknown as Model<Invoice>, bookings as unknown as Model<Booking>, payments as unknown as Model<PaymentTransaction>, pricing, new PersistedInvoiceChargesAdapter());
  return { service, booking, invoices, bookings, payments, pricing, save, retry: (n: number) => { versionFailures = n; }, id: String(booking._id) };
}

describe('InvoicesService', () => {
  it('creates one validated invoice and reuses it', async () => {
    const s = setup();
    const first = await s.service.getOrCreateForBooking(s.id);
    expect(first.totalAmount).toBe(1000000);
    expect(String((await s.service.getOrCreateForBooking(s.id))._id)).toBe(String(first._id));
    expect(s.save).toHaveBeenCalledTimes(1);
  });
  it('recovers the unique-index winner on concurrent creation', async () => {
    const s = setup();
    const winner = await s.service.getOrCreateForBooking(s.id);
    s.invoices.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(winner);
    s.save.mockRejectedValueOnce(Object.assign(new Error(), { code: 11000 }));
    expect(await s.service.getOrCreateForBooking(s.id)).toBe(winner);
  });
  it('fails closed when pricing is unavailable', async () => {
    const s = setup();
    s.pricing.getRoomLines.mockImplementation((booking) => new UnavailableInvoicePricingAdapter().getRoomLines(booking) as never);
    await expect(s.service.getOrCreateForBooking(s.id)).rejects.toThrow('snapshot');
    expect(s.save).not.toHaveBeenCalled();
  });
  it('requires exact booked room coverage', async () => {
    const s = setup();
    s.pricing.getRoomLines.mockResolvedValue([]);
    await expect(s.service.getOrCreateForBooking(s.id)).rejects.toThrow('booked rooms');
  });
  it('persists approved charges and deduplicates stable sources across recalculation', async () => {
    const s = setup();
    const charge = { bookingId: s.id, type: InvoiceChargeType.Service, amount: 10000, reason: 'Laundry', sourceId: 'service-order:1' };
    await s.service.addCharge(charge);
    await s.service.addCharge(charge);
    const invoice = await s.service.recalculate(s.id);
    expect(invoice.serviceTotal).toBe(10000);
    expect(invoice.charges).toHaveLength(1);
    expect(invoice.charges[0].approved).toBe(true);
    await expect(s.service.addCharge({ ...charge, amount: 20000 })).rejects.toThrow('different content');
  });
  it('includes additional charges discounts and taxes without invented percentages', async () => {
    const s = setup();
    for (const [type, amount] of [[InvoiceChargeType.Additional, 10000], [InvoiceChargeType.Discount, 5000], [InvoiceChargeType.Tax, 2000]] as const) {
      await s.service.addCharge({ bookingId: s.id, type, amount, reason: 'Approved adjustment' });
    }
    expect((await s.service.recalculate(s.id)).totalAmount).toBe(1007000);
  });
  it.each([-1, 0.5, NaN, Infinity])('rejects invalid charge %s', async (amount) => {
    const s = setup();
    await expect(s.service.addCharge({ bookingId: s.id, type: InvoiceChargeType.Additional, amount, reason: 'Damage' })).rejects.toThrow();
    expect(s.save).not.toHaveBeenCalled();
  });
  it('rejects invalid type reason and source', async () => {
    const s = setup();
    const charge = { bookingId: s.id, type: InvoiceChargeType.Additional, amount: 1, reason: 'Fee' };
    for (const change of [{ type: 'UNKNOWN' }, { reason: ' ' }, { sourceId: ' ' }]) {
      await expect(s.service.addCharge({ ...charge, ...change } as typeof charge)).rejects.toThrow();
    }
  });
  it('rejects charges after checkout', async () => {
    const s = setup();
    s.booking.status = BookingStatus.CheckedOut;
    await expect(s.service.addCharge({ bookingId: s.id, type: InvoiceChargeType.Additional, amount: 1, reason: 'Fee' })).rejects.toThrow('closed booking');
  });
  it('retries optimistic conflicts without duplicating charges', async () => {
    const s = setup();
    await s.service.getOrCreateForBooking(s.id);
    s.retry(2);
    const result = await s.service.addCharge({ bookingId: s.id, type: InvoiceChargeType.Service, amount: 1, reason: 'Service', sourceId: 'order:2' });
    expect(result.charges).toHaveLength(1);
    expect(result.serviceTotal).toBe(1);
  });
  it('bounds retries and propagates other save failures', async () => {
    const s = setup();
    await s.service.getOrCreateForBooking(s.id);
    s.retry(5);
    await expect(s.service.recalculate(s.id)).rejects.toThrow('concurrently');
    s.save.mockRejectedValueOnce(new Error('database unavailable'));
    await expect(s.service.recalculate(s.id)).rejects.toThrow('database unavailable');
  });
  it('uses validated persisted payments only and never booking depositAmount', async () => {
    const s = setup();
    const invoice = await s.service.getOrCreateForBooking(s.id);
    s.booking.depositAmount = 900000;
    s.payments.find.mockResolvedValue([new PaymentModel({ booking: s.booking._id, invoice: invoice._id, transactionRef: 'deposit', method: 'CASH', purpose: 'DEPOSIT', status: 'SUCCESS', amount: 200000, paidAt: new Date() })]);
    expect(await s.service.recalculate(s.id)).toMatchObject({ depositPaid: 200000, finalPaid: 0, balanceDue: 800000 });
    expect(s.payments.find).toHaveBeenLastCalledWith({ booking: s.booking._id, invoice: invoice._id, status: 'SUCCESS', isActive: true });
    expect((await s.service.recalculate(s.id)).depositPaid).toBe(200000);
  });
  it('rejects unvalidated or mislinked successful payment records', async () => {
    const s = setup();
    const invoice = await s.service.getOrCreateForBooking(s.id);
    s.payments.find.mockResolvedValue([new PaymentModel({ booking: s.booking._id, invoice: invoice._id, transactionRef: 'vnpay', method: 'VNPAY', purpose: 'FINAL', status: 'SUCCESS', amount: 1 })]);
    await expect(s.service.recalculate(s.id)).rejects.toThrow('Invalid successful payment');
  });
  it('rejects malformed and missing bookings', async () => {
    const s = setup();
    await expect(s.service.getOrCreateForBooking('bad')).rejects.toThrow('Invalid booking');
    s.bookings.findById.mockResolvedValueOnce(null as never);
    await expect(s.service.getOrCreateForBooking(s.id)).rejects.toThrow('not found');
  });
});
