import { calculateInvoice, type InvoiceCalculationInput } from './invoice-calculator.js';
import { InvoiceStatus } from './schemas/invoice.schema.js';
import { PaymentPurpose, PaymentStatus } from '../payments/schemas/payment-transaction.schema.js';

const input = (): InvoiceCalculationInput => ({
  rooms: [{ rate: 500000, units: 2 }], serviceCharges: [], approvedAdditionalCharges: [],
  discounts: [], taxes: [], payments: [],
});
const payment = (amount: number, purpose = PaymentPurpose.Deposit, status = PaymentStatus.Success) =>
  ({ transactionRef: `${purpose}-${amount}`, amount, purpose, status });

describe('invoice calculator', () => {
  it('calculates a single room with explicit billable duration', () => {
    expect(calculateInvoice(input())).toMatchObject({ roomTotal: 1000000, balanceDue: 1000000, status: InvoiceStatus.Unpaid });
  });
  it('calculates multiple authoritative rate and duration lines', () => {
    expect(calculateInvoice({ ...input(), rooms: [{ rate: 100000, units: 3 }, { rate: 200000, units: 2 }] }).roomTotal).toBe(700000);
  });
  it('includes explicit service, approved additional, discount and tax amounts', () => {
    expect(calculateInvoice({ ...input(), serviceCharges: [100000, 50000], approvedAdditionalCharges: [20000], discounts: [30000], taxes: [10000] })).toMatchObject({ totalAmount: 1150000, serviceTotal: 150000, additionalTotal: 20000, discountTotal: 30000, taxTotal: 10000 });
  });
  it.each([0, 200000, 1000000])('maintains balance for payment %i', (amount) => {
    const result = calculateInvoice({ ...input(), payments: [payment(amount)] });
    expect(result.balanceDue).toBe(result.totalAmount - result.depositPaid - result.finalPaid);
    expect(result.status).toBe(amount === 0 ? InvoiceStatus.Unpaid : amount === 1000000 ? InvoiceStatus.Paid : InvoiceStatus.PartiallyPaid);
  });
  it('categorizes payments without counting a deposit twice', () => {
    const deposit = payment(200000);
    expect(calculateInvoice({ ...input(), payments: [deposit, deposit, payment(800000, PaymentPurpose.Final)] })).toMatchObject({ depositPaid: 200000, finalPaid: 800000, balanceDue: 0 });
  });
  it.each([PaymentStatus.Pending, PaymentStatus.Failed, PaymentStatus.Cancelled])('ignores %s payments', (status) => {
    expect(calculateInvoice({ ...input(), payments: [payment(1000000, PaymentPurpose.Deposit, status)] }).depositPaid).toBe(0);
  });
  it.each([-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])('rejects invalid money %s in every charge category', (value) => {
    for (const key of ['serviceCharges', 'approvedAdditionalCharges', 'discounts', 'taxes'] as const) {
      expect(() => calculateInvoice({ ...input(), [key]: [value] })).toThrow(RangeError);
    }
    expect(() => calculateInvoice({ ...input(), rooms: [{ rate: value, units: 1 }] })).toThrow(RangeError);
    expect(() => calculateInvoice({ ...input(), payments: [payment(value)] })).toThrow(RangeError);
  });
  it.each([0, -1, 1.5, NaN, Infinity])('rejects invalid duration %s', (units) => {
    expect(() => calculateInvoice({ ...input(), rooms: [{ rate: 1, units }] })).toThrow(RangeError);
  });
  it('rejects overflow, excessive discounts and overpayment rather than clamping balance', () => {
    expect(() => calculateInvoice({ ...input(), rooms: [{ rate: Number.MAX_SAFE_INTEGER, units: 2 }] })).toThrow();
    expect(() => calculateInvoice({ ...input(), discounts: [1000001] })).toThrow();
    expect(() => calculateInvoice({ ...input(), payments: [payment(1000001)] })).toThrow();
  });
  it('rejects conflicting duplicate payments', () => {
    const deposit = payment(200000);
    expect(() => calculateInvoice({ ...input(), payments: [deposit, { ...deposit, amount: 300000 }] })).toThrow();
  });
  it('handles a zero-priced room without inventing charges', () => {
    expect(calculateInvoice({ ...input(), rooms: [{ rate: 0, units: 1 }] })).toMatchObject({ totalAmount: 0, balanceDue: 0, status: InvoiceStatus.Paid });
  });
  it('is deterministic and does not mutate inputs on repeated recalculation', () => {
    const source = input();
    const snapshot = structuredClone(source);
    expect(calculateInvoice(source)).toEqual(calculateInvoice(source));
    expect(source).toEqual(snapshot);
  });
});
