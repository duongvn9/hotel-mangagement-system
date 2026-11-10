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
  };
  const invoices = { addCharge: vi.fn(async () => invoice) };
  const sut = new CheckoutChargesService(
    bookings as never,
    services as never,
    invoices as never,
  );
  return { sut, invoices, services };
}

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
