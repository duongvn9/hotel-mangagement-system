import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { isMoneyVnd } from '../../common/database/conventions.js';
import {
  Booking,
  BookingStatus,
  type BookingDocument,
} from '../bookings/schemas/booking.schema.js';
import {
  PaymentMethod,
  PaymentStatus,
  PaymentTransaction,
} from '../payments/schemas/payment-transaction.schema.js';
import { Invoice, type InvoiceDocument } from './schemas/invoice.schema.js';
import {
  InvoiceChargeType,
  type InvoiceCharge,
} from './schemas/invoice-charge.schema.js';
import {
  InvoiceChargesAdapter,
  InvoicePricingAdapter,
} from './invoice-adapters.js';
import { calculateInvoice } from './invoice-calculator.js';

export interface AddInvoiceCharge {
  bookingId: string;
  type: InvoiceChargeType;
  amount: number;
  reason: string;
  sourceId?: string;
}

@Injectable()
export class InvoicesService {
  constructor(
    @InjectModel(Invoice.name) private readonly invoices: Model<Invoice>,
    @InjectModel(Booking.name) private readonly bookings: Model<Booking>,
    @InjectModel(PaymentTransaction.name)
    private readonly payments: Model<PaymentTransaction>,
    @Inject(InvoicePricingAdapter)
    private readonly pricing: InvoicePricingAdapter,
    @Inject(InvoiceChargesAdapter)
    private readonly chargeSource: InvoiceChargesAdapter,
  ) {}

  async getOrCreateForBooking(bookingId: string): Promise<InvoiceDocument> {
    const booking = await this.booking(bookingId);
    const existing = await this.invoices.findOne({ booking: booking._id });
    if (existing) {
      this.active(existing);
      return existing;
    }
    await this.invoices.init();
    const invoice = new this.invoices({
      booking: booking._id,
      code: `INV-${booking._id}`,
      charges: [],
    });
    await this.calculate(invoice, booking);
    try {
      return await invoice.save();
    } catch (error) {
      if ((error as { code?: number }).code !== 11000) throw error;
      const winner = await this.invoices.findOne({ booking: booking._id });
      if (!winner) throw error;
      this.active(winner);
      return winner;
    }
  }

  async addCharge(input: AddInvoiceCharge): Promise<InvoiceDocument> {
    if (
      typeof input.reason !== 'string' ||
      (input.sourceId !== undefined && typeof input.sourceId !== 'string')
    ) {
      throw new BadRequestException('Invalid charge reason or source');
    }
    const charge: InvoiceCharge = {
      type: input.type,
      amount: input.amount,
      reason: input.reason?.trim(),
      approved: true,
      ...(input.sourceId === undefined
        ? {}
        : { sourceId: input.sourceId.trim() }),
    };
    this.validateCharge(charge);
    if (input.sourceId !== undefined && !charge.sourceId)
      throw new BadRequestException('Invalid charge source');
    return this.update(input.bookingId, charge);
  }

  async recalculate(bookingId: string): Promise<InvoiceDocument> {
    return this.update(bookingId);
  }

  private async update(
    bookingId: string,
    charge?: InvoiceCharge,
  ): Promise<InvoiceDocument> {
    await this.getOrCreateForBooking(bookingId);
    for (let attempt = 0; attempt < 5; attempt++) {
      const invoice = await this.invoices.findOne({
        booking: new Types.ObjectId(bookingId),
      });
      if (!invoice) throw new NotFoundException('Invoice not found');
      this.active(invoice);
      const booking = await this.booking(bookingId);
      if (charge) {
        await this.chargeSource.getApprovedCharges(invoice);
        if (
          [BookingStatus.CheckedOut, BookingStatus.Cancelled].includes(
            booking.status,
          )
        ) {
          throw new ConflictException(
            'Charges cannot be added to a closed booking',
          );
        }
        const previous = charge.sourceId
          ? invoice.charges.find((item) => item.sourceId === charge.sourceId)
          : undefined;
        if (previous) {
          if (
            previous.type !== charge.type ||
            previous.amount !== charge.amount ||
            previous.reason !== charge.reason
          ) {
            throw new ConflictException(
              'Charge source already has different content',
            );
          }
        } else invoice.charges.push(charge);
      }
      await this.calculate(invoice, booking);
      invoice.markModified('balanceDue');
      try {
        return await invoice.save();
      } catch (error) {
        if ((error as Error).name !== 'VersionError') throw error;
      }
    }
    throw new ConflictException(
      'Invoice changed concurrently; retry the operation',
    );
  }

  private async booking(id: string): Promise<BookingDocument> {
    if (!/^[a-f\d]{24}$/i.test(id))
      throw new BadRequestException('Invalid booking ID');
    const booking = await this.bookings.findById(id);
    if (!booking || !booking.isActive)
      throw new NotFoundException('Booking not found');
    return booking;
  }

  private active(invoice: InvoiceDocument): void {
    if (!invoice.isActive) throw new ConflictException('Invoice is inactive');
  }

  private validateCharge(charge: InvoiceCharge): void {
    if (
      !Object.values(InvoiceChargeType).includes(charge.type) ||
      !isMoneyVnd(charge.amount) ||
      typeof charge.reason !== 'string' ||
      !charge.reason.trim() ||
      charge.approved !== true ||
      (charge.sourceId !== undefined &&
        (typeof charge.sourceId !== 'string' || !charge.sourceId.trim()))
    ) {
      throw new BadRequestException('Invalid approved invoice charge');
    }
  }

  private async calculate(
    invoice: InvoiceDocument,
    booking: BookingDocument,
  ): Promise<void> {
    const rooms = await this.pricing.getRoomLines(booking);
    const roomIds = new Set(rooms.map((room) => room.roomId));
    if (
      roomIds.size !== booking.rooms.length ||
      booking.rooms.some((id) => !roomIds.has(String(id)))
    ) {
      throw new ConflictException(
        'Pricing must cover exactly the booked rooms',
      );
    }
    const charges = await this.chargeSource.getApprovedCharges(invoice);
    const unique = new Map<string, InvoiceCharge>();
    const accepted: InvoiceCharge[] = [];
    for (const charge of charges) {
      this.validateCharge(charge);
      const previous = charge.sourceId
        ? unique.get(charge.sourceId)
        : undefined;
      if (previous) {
        if (
          previous.type !== charge.type ||
          previous.amount !== charge.amount ||
          previous.reason !== charge.reason
        ) {
          throw new ConflictException('Conflicting charge source');
        }
        continue;
      }
      if (charge.sourceId) unique.set(charge.sourceId, charge);
      accepted.push(charge);
    }
    const payments = await this.payments.find({
      booking: booking._id,
      invoice: invoice._id,
      status: PaymentStatus.Success,
      isActive: true,
    });
    const providerRefs = new Set<string>();
    for (const payment of payments) {
      await payment.validate();
      if (
        !payment.booking.equals(booking._id) ||
        !payment.invoice.equals(invoice._id) ||
        payment.status !== PaymentStatus.Success ||
        !payment.isActive ||
        !(payment.paidAt instanceof Date) ||
        !Number.isFinite(payment.paidAt.getTime()) ||
        (payment.method === PaymentMethod.Vnpay &&
          !payment.providerTransactionRef?.trim())
      ) {
        throw new ConflictException('Invalid successful payment record');
      }
      if (payment.providerTransactionRef) {
        const ref = `${payment.method}:${payment.providerTransactionRef}`;
        if (providerRefs.has(ref))
          throw new ConflictException('Duplicate provider payment');
        providerRefs.add(ref);
      }
    }
    const amounts = (type: InvoiceChargeType) =>
      accepted
        .filter((charge) => charge.type === type)
        .map((charge) => charge.amount);
    try {
      invoice.set(
        calculateInvoice({
          rooms,
          serviceCharges: amounts(InvoiceChargeType.Service),
          approvedAdditionalCharges: amounts(InvoiceChargeType.Additional),
          discounts: amounts(InvoiceChargeType.Discount),
          taxes: amounts(InvoiceChargeType.Tax),
          payments,
        }),
      );
    } catch (error) {
      if (error instanceof RangeError)
        throw new BadRequestException(error.message);
      throw error;
    }
    await invoice.validate();
  }
}
