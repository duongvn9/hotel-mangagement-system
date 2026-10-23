import { isMoneyVnd } from '../../common/database/conventions.js';
import { InvoiceStatus } from './schemas/invoice.schema.js';
import { PaymentPurpose, PaymentStatus } from '../payments/schemas/payment-transaction.schema.js';

export interface InvoiceCalculationInput {
  rooms: ReadonlyArray<{ rate: number; units: number }>;
  serviceCharges: readonly number[];
  approvedAdditionalCharges: readonly number[];
  discounts: readonly number[];
  taxes: readonly number[];
  payments: ReadonlyArray<{
    transactionRef: string;
    status: PaymentStatus;
    purpose: PaymentPurpose;
    amount: number;
  }>;
}

const money = (value: number): number => {
  if (!isMoneyVnd(value)) throw new RangeError('Amounts must be safe non-negative integer VND');
  return value;
};

const sum = (values: readonly number[]): number =>
  values.reduce((total, value) => money(total + money(value)), 0);

export function calculateInvoice(input: InvoiceCalculationInput) {
  if (input.rooms.length === 0) throw new RangeError('At least one room is required');
  const roomTotal = sum(input.rooms.map(({ rate, units }) => {
    if (!Number.isSafeInteger(units) || units <= 0) throw new RangeError('Invalid billable duration');
    return money(money(rate) * units);
  }));
  const serviceTotal = sum(input.serviceCharges);
  const additionalTotal = sum(input.approvedAdditionalCharges);
  const discountTotal = sum(input.discounts);
  const taxTotal = sum(input.taxes);
  const totalAmount = money(sum([roomTotal, serviceTotal, additionalTotal, taxTotal]) - discountTotal);
  let depositPaid = 0;
  let finalPaid = 0;
  const seen = new Map<string, { purpose: PaymentPurpose; amount: number }>();
  for (const payment of input.payments) {
    if (!Object.values(PaymentStatus).includes(payment.status)) throw new RangeError('Invalid payment status');
    if (payment.status !== PaymentStatus.Success) continue;
    if (!payment.transactionRef?.trim()) throw new RangeError('Missing payment reference');
    if (!Object.values(PaymentPurpose).includes(payment.purpose)) throw new RangeError('Invalid payment purpose');
    money(payment.amount);
    const previous = seen.get(payment.transactionRef);
    if (previous) {
      if (previous.purpose !== payment.purpose || previous.amount !== payment.amount) {
        throw new RangeError('Conflicting duplicate payment');
      }
      continue;
    }
    seen.set(payment.transactionRef, payment);
    if (payment.purpose === PaymentPurpose.Deposit) depositPaid = sum([depositPaid, payment.amount]);
    else finalPaid = sum([finalPaid, payment.amount]);
  }
  const paid = sum([depositPaid, finalPaid]);
  const balanceDue = money(totalAmount - paid);
  const status = balanceDue === 0 ? InvoiceStatus.Paid : paid > 0 ? InvoiceStatus.PartiallyPaid : InvoiceStatus.Unpaid;
  return { roomTotal, serviceTotal, additionalTotal, discountTotal, taxTotal, totalAmount, depositPaid, finalPaid, balanceDue, status };
}
