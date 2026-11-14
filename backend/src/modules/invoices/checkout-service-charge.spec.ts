import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Types } from 'mongoose';
import { BookingStatus } from '../bookings/schemas/booking.schema.js';
import { CheckoutChargesService } from './checkout-charges.service.js';
import { toBookingChargesResponse } from './invoice-summary.js';
import { PersistedInvoiceChargesAdapter } from './invoice-adapters.js';
import {
  AddCheckoutChargeDto,
  AddCheckoutServiceDto,
} from './dto/checkout-charge.dto.js';
import {
  ChargeCategory,
  InvoiceChargeType,
} from './schemas/invoice-charge.schema.js';

const bookingId = new Types.ObjectId().toHexString();
const serviceId = new Types.ObjectId().toHexString();

function setup(
  options: {
    status?: BookingStatus;
    service?: Record<string, unknown> | null;
    charges?: unknown[];
    orders?: Record<string, unknown>[];
    invoice?: Record<string, unknown>;
  } = {},
) {
  const booking = {
    _id: new Types.ObjectId(bookingId),
    code: 'BK-1',
    status: options.status ?? BookingStatus.CheckedIn,
    isActive: true,
  };
  const service =
    options.service === undefined
      ? {
          _id: new Types.ObjectId(serviceId),
          name: 'Giặt ủi',
          unit: 'kg',
          billable: true,
          price: 50_000,
          isActive: true,
        }
      : options.service;
  const bookings = {
    findById: vi.fn(async () => booking),
    updateOne: vi.fn(async () => ({ modifiedCount: 1 })),
    exists: vi.fn(async () => ({ _id: booking._id })),
  };
  const services = { findById: vi.fn(async () => service) };
  const invoice = {
    status: 'UNPAID',
    roomTotal: 0,
    serviceTotal: 150_000,
    additionalTotal: 0,
    discountTotal: 0,
    taxTotal: 0,
    totalAmount: 150_000,
    depositPaid: 0,
    finalPaid: 0,
    balanceDue: 150_000,
    charges: options.charges ?? [],
    _id: new Types.ObjectId(),
    booking: booking._id,
    isActive: true,
    ...options.invoice,
  };
  const invoices = {
    addCharge: vi.fn(async () => invoice),
    getOrCreateForBooking: vi.fn(async () => invoice),
  };
  // list() asks whether a VNPay payment is still pending; none is in these tests.
  const payments = { exists: vi.fn(async () => null) };
  const orders = {
    find: vi.fn(() => ({
      select: vi.fn(() => ({ lean: vi.fn(async () => options.orders ?? []) })),
    })),
  };
  const sut = new CheckoutChargesService(
    bookings as never,
    services as never,
    payments as never,
    invoices as never,
    orders as never,
  );
  return { sut, invoices, services, bookings, booking, orders, invoice };
}

describe('CheckoutChargesService.list snapshot presentation', () => {
  const id = new Types.ObjectId();
  const charge = {
    type: InvoiceChargeType.Service,
    sourceId: String(id),
    reason: `Service order ${id}`,
    amount: 150_000,
    approved: true,
  };
  const order = {
    _id: id,
    booking: new Types.ObjectId(bookingId),
    serviceName: 'Giặt ủi lịch sử',
    quantity: 3,
    unitPriceVND: 50_000,
    amount: 150_000,
  };

  it('adds immutable snapshot display fields without changing evidence or totals', async () => {
    const { sut, services, invoice, orders, booking, bookings, invoices } =
      setup({
        charges: [charge],
        orders: [order],
      });
    const before = JSON.stringify(invoice);
    const canonical = toBookingChargesResponse(booking, invoice as never);
    const adapter = new PersistedInvoiceChargesAdapter();
    const evidence = await adapter.getApprovedCharges(invoice as never);
    const result = await sut.list(bookingId);
    expect(result.charges[0]).toEqual({
      type: charge.type,
      sourceId: charge.sourceId,
      reason: charge.reason,
      amount: charge.amount,
      serviceName: order.serviceName,
      quantity: 3,
      unitPriceVND: 50_000,
    });
    expect(result.totals).toEqual(canonical.totals);
    expect(JSON.stringify(invoice)).toBe(before);
    expect(await adapter.getApprovedCharges(invoice as never)).toEqual(
      evidence,
    );
    expect(toBookingChargesResponse(booking, invoice as never)).toEqual(
      canonical,
    );
    expect(bookings.updateOne).not.toHaveBeenCalled();
    expect(invoices.addCharge).not.toHaveBeenCalled();
    expect(services.findById).not.toHaveBeenCalled();
    expect(orders.find).toHaveBeenCalledWith({
      _id: { $in: [String(id)] },
      booking: invoice.booking,
    });
  });

  it.each([
    ['missing snapshot', {}, [], {}],
    ['duplicate snapshots', {}, [order, order], {}],
    ['wrong identity', {}, [{ ...order, _id: new Types.ObjectId() }], {}],
    ['wrong booking', {}, [{ ...order, booking: new Types.ObjectId() }], {}],
    ['wrong reason', { reason: 'Edited' }, [order], {}],
    ['wrong type', { type: InvoiceChargeType.Additional }, [order], {}],
    ['unapproved', { approved: false }, [order], {}],
    ['missing approval', { approved: undefined }, [order], {}],
    ['invalid source', { sourceId: 'not-an-object-id' }, [order], {}],
    ['missing source', { sourceId: undefined }, [order], {}],
    ['missing quantity', {}, [{ ...order, quantity: undefined }], {}],
    ['missing price', {}, [{ ...order, unitPriceVND: undefined }], {}],
    ['missing amount', {}, [{ ...order, amount: undefined }], {}],
    ['missing name', {}, [{ ...order, serviceName: undefined }], {}],
    ['wrong amount', { amount: 1 }, [order], {}],
    ['bad arithmetic', {}, [{ ...order, amount: 1 }], {}],
    ['fractional quantity', {}, [{ ...order, quantity: 1.5 }], {}],
    ['zero quantity', {}, [{ ...order, quantity: 0 }], {}],
    ['negative price', {}, [{ ...order, unitPriceVND: -50_000 }], {}],
    [
      'unsafe arithmetic',
      {},
      [{ ...order, quantity: Number.MAX_SAFE_INTEGER }],
      {},
    ],
    ['empty name', {}, [{ ...order, serviceName: ' ' }], {}],
    ['inactive invoice', {}, [order], { isActive: false }],
    ['wrong invoice booking', {}, [order], { booking: new Types.ObjectId() }],
  ])(
    'keeps original fallback for %s',
    async (_label, override, rows, invoice) => {
      const { sut } = setup({
        charges: [{ ...charge, ...override }],
        orders: rows,
        invoice,
      });
      const result = await sut.list(bookingId);
      expect(result.charges[0]).not.toHaveProperty('serviceName');
      expect(result.charges[0]).not.toHaveProperty('quantity');
      expect(result.charges[0]).not.toHaveProperty('unitPriceVND');
      expect(result.charges[0].reason).toBe(override.reason ?? charge.reason);
      expect(result.charges[0].amount).toBe(override.amount ?? charge.amount);
    },
  );

  it('rejects duplicate source evidence across all charge types', async () => {
    const { sut } = setup({
      charges: [charge, { ...charge, type: InvoiceChargeType.Additional }],
      orders: [order],
    });
    expect(
      (await sut.list(bookingId)).charges.every(
        (line) => !('serviceName' in line),
      ),
    ).toBe(true);
  });

  it('falls back if snapshot reading fails', async () => {
    const { sut, orders } = setup({ charges: [charge] });
    orders.find.mockImplementation(() => {
      throw new Error('unavailable');
    });
    expect((await sut.list(bookingId)).charges[0].reason).toBe(charge.reason);
  });

  it('does not enrich write responses even when canonical snapshot evidence exists', async () => {
    const { sut, orders } = setup({ charges: [charge], orders: [order] });
    const results = [
      await sut.add(bookingId, {
        amount: 1,
        reason: 'Manual',
        requestId: 'req-12345678',
      }),
      await sut.addService(bookingId, {
        serviceId,
        quantity: 1,
        requestId: 'req-12345678',
      }),
      await sut.confirmFees(bookingId),
    ];
    for (const result of results) {
      expect(result.charges[0]).toEqual({
        type: charge.type,
        sourceId: charge.sourceId,
        reason: charge.reason,
        amount: charge.amount,
      });
    }
    expect(orders.find).not.toHaveBeenCalled();
  });

  it('does not read snapshots for manual charges or write responses', async () => {
    const { sut, orders } = setup({
      charges: [{ ...charge, sourceId: 'frontdesk-service:req-12345678' }],
    });
    await sut.list(bookingId);
    await sut.add(bookingId, {
      amount: 1,
      reason: 'Manual',
      requestId: 'req-12345678',
    });
    await sut.addService(bookingId, {
      serviceId,
      quantity: 1,
      requestId: 'req-12345678',
    });
    await sut.confirmFees(bookingId);
    expect(orders.find).not.toHaveBeenCalled();
  });
});

describe('CheckoutChargesService.addService', () => {
  it('records a SERVICE charge of price x quantity with a readable reason', async () => {
    const { sut, invoices } = setup();

    await sut.addService(bookingId, {
      serviceId,
      quantity: 3,
      requestId: 'req-12345678',
    });

    expect(invoices.addCharge).toHaveBeenCalledWith({
      bookingId,
      type: InvoiceChargeType.Service,
      amount: 150_000,
      reason: 'Giặt ủi x3 (kg)',
      sourceId: 'frontdesk-service:req-12345678',
    });
  });

  it('refuses a guest who is not checked in and records nothing', async () => {
    const { sut, invoices } = setup({ status: BookingStatus.Confirmed });

    await expect(
      sut.addService(bookingId, {
        serviceId,
        quantity: 1,
        requestId: 'req-12345678',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(invoices.addCharge).not.toHaveBeenCalled();
  });

  it('returns 404 for an unknown or inactive service', async () => {
    const unknown = setup({ service: null });
    await expect(
      unknown.sut.addService(bookingId, {
        serviceId,
        quantity: 1,
        requestId: 'req-12345678',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    const inactive = setup({
      service: { name: 'Spa', billable: true, price: 1, isActive: false },
    });
    await expect(
      inactive.sut.addService(bookingId, {
        serviceId,
        quantity: 1,
        requestId: 'req-12345678',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('refuses a service that is free or has no price', async () => {
    for (const service of [
      { name: 'Wifi', billable: false, price: null, isActive: true },
      { name: 'Spa', billable: true, price: null, isActive: true },
    ]) {
      const { sut, invoices } = setup({ service });
      await expect(
        sut.addService(bookingId, {
          serviceId,
          quantity: 1,
          requestId: 'req-12345678',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(invoices.addCharge).not.toHaveBeenCalled();
    }
  });
});

describe('AddCheckoutServiceDto', () => {
  const check = (input: object) =>
    validate(plainToInstance(AddCheckoutServiceDto, input));

  it('accepts a valid body', async () => {
    expect(
      await check({ serviceId, quantity: 2, requestId: 'req-12345678' }),
    ).toHaveLength(0);
  });

  it.each([
    ['quantity below 1', { quantity: 0 }],
    ['quantity above 99', { quantity: 100 }],
    ['fractional quantity', { quantity: 1.5 }],
    ['malformed service id', { serviceId: 'abc' }],
    ['short request id', { requestId: 'x' }],
  ])('rejects %s', async (_name, override) => {
    const errors = await check({
      serviceId,
      quantity: 1,
      requestId: 'req-12345678',
      ...override,
    });
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('Guest confirmation of the check-out fees', () => {
  const body = { amount: 30_000, reason: 'Vỡ ly', requestId: 'req-12345678' };

  it('records when the guest confirmed the fees and returns it', async () => {
    const { sut, bookings } = setup();

    const result = await sut.confirmFees(bookingId);

    expect(bookings.updateOne).toHaveBeenCalledWith(
      { _id: expect.anything(), status: BookingStatus.CheckedIn },
      { $set: { checkoutFeesConfirmedAt: expect.any(Date) } },
    );
    expect(result.feesConfirmedAt).toEqual(expect.any(String));
  });

  it('refuses a guest who is not checked in', async () => {
    const { sut, bookings } = setup({ status: BookingStatus.Confirmed });

    await expect(sut.confirmFees(bookingId)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(bookings.updateOne).not.toHaveBeenCalledWith(expect.anything(), {
      $set: { checkoutFeesConfirmedAt: expect.any(Date) },
    });
  });

  it('shows the confirmation time in the charge list', async () => {
    const confirmedAt = new Date('2026-11-10T05:00:00Z');
    const { sut, booking } = setup();
    Object.assign(booking, { checkoutFeesConfirmedAt: confirmedAt });

    const result = await sut.list(bookingId);

    expect(result.feesConfirmedAt).toBe(confirmedAt.toISOString());
  });
});

describe('CheckoutChargesService.add with a category', () => {
  const body = {
    amount: 30_000,
    reason: 'Vỡ ly',
    requestId: 'req-12345678',
  };

  it('passes the category through to the invoice and returns it', async () => {
    const { sut, invoices } = setup({
      charges: [
        {
          type: InvoiceChargeType.Additional,
          amount: 30_000,
          reason: 'Vỡ ly',
          category: ChargeCategory.Damage,
          sourceId: 'checkout:req-12345678',
        },
      ],
    });

    const result = await sut.add(bookingId, {
      ...body,
      category: ChargeCategory.Damage,
    });

    expect(invoices.addCharge).toHaveBeenCalledWith({
      bookingId,
      type: InvoiceChargeType.Additional,
      amount: 30_000,
      reason: 'Vỡ ly',
      category: ChargeCategory.Damage,
      sourceId: 'checkout:req-12345678',
    });
    expect(result.charges[0].category).toBe(ChargeCategory.Damage);
  });

  it('still works without a category', async () => {
    const { sut, invoices } = setup();

    await sut.add(bookingId, body);

    expect(invoices.addCharge).toHaveBeenCalledWith(
      expect.not.objectContaining({ category: expect.anything() }),
    );
  });
});

describe('AddCheckoutChargeDto category', () => {
  const check = (input: object) =>
    validate(plainToInstance(AddCheckoutChargeDto, input));
  const base = { amount: 1000, reason: 'x', requestId: 'req-12345678' };

  it.each(['DAMAGE', 'LATE_CHECKOUT', 'OTHER'])(
    'accepts %s',
    async (category) => {
      expect(await check({ ...base, category })).toHaveLength(0);
    },
  );

  it('accepts a missing category and rejects an unknown one', async () => {
    expect(await check(base)).toHaveLength(0);
    expect(
      (await check({ ...base, category: 'MINIBAR' })).length,
    ).toBeGreaterThan(0);
  });
});
