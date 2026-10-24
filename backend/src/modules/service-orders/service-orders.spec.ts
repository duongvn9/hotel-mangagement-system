import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Types } from 'mongoose';
import {
  AssignServiceOrderDto,
  ServiceHistoryQuery,
  CreateServiceOrderDto,
  ListServiceOrdersQuery,
} from './dto/service-order.dto.js';
import { ServiceOrderSchema } from './schemas/service-order.schema.js';
import { ServiceOrdersService } from './service-orders.service.js';

const user = {
  id: String(new Types.ObjectId()),
  email: 'fixture@example.com',
  role: 'CUSTOMER',
};
const dto = {
  bookingId: String(new Types.ObjectId()),
  serviceId: String(new Types.ObjectId()),
  quantity: 2,
};
const model = (value: unknown) => ({
  findOne: () => ({ exec: async () => value }),
  findById: () => ({ exec: async () => value }),
});

describe('service orders contract', () => {
  it('validates assignment and history contracts without nullable or foreign fields', async () => {
    for (const payload of [
      { assigneeId: user.id, dueAt: null },
      { assigneeId: 'bad' },
      { assigneeId: user.id, title: 'override' },
      { assigneeId: user.id, dueAt: 'not-a-date' },
    ])
      expect(
        (
          await validate(plainToInstance(AssignServiceOrderDto, payload), {
            whitelist: true,
            forbidNonWhitelisted: true,
          })
        ).length,
      ).toBeGreaterThan(0);
    expect(
      await validate(
        plainToInstance(AssignServiceOrderDto, { assigneeId: user.id }),
      ),
    ).toHaveLength(0);
    for (const payload of [
      { page: 0 },
      { limit: 101 },
      { from: null },
      { to: 'bad' },
    ])
      expect(
        (await validate(plainToInstance(ServiceHistoryQuery, payload))).length,
      ).toBeGreaterThan(0);
  });

  it('uses the Task source collection and real partial customer/key unique index', () => {
    expect(ServiceOrderSchema.get('collection')).toBe('serviceorders');
    expect(ServiceOrderSchema.indexes()).toEqual(
      expect.arrayContaining([
        [
          { customer: 1, requestId: 1 },
          expect.objectContaining({
            unique: true,
            partialFilterExpression: { requestId: { $exists: true } },
          }),
        ],
      ]),
    );
  });

  it('allows optional time but rejects null and client extras', async () => {
    expect(
      await validate(plainToInstance(CreateServiceOrderDto, dto)),
    ).toHaveLength(0);
    for (const extra of [
      { quantity: 0 },
      { quantity: '2' },
      { requestedTime: null },
      { customer: user.id },
      { amount: 0 },
    ])
      expect(
        (
          await validate(
            plainToInstance(CreateServiceOrderDto, { ...dto, ...extra }),
            { whitelist: true, forbidNonWhitelisted: true },
          )
        ).length,
      ).toBeGreaterThan(0);
    expect(
      await validate(
        plainToInstance(ListServiceOrdersQuery, { page: '2', limit: '5' }),
      ),
    ).toHaveLength(0);
  });

  it('verifies persisted billing through the Invoice model without invoking H7 writes or creation', async () => {
    const billedInvoiceId = new Types.ObjectId();
    const row = {
      _id: new Types.ObjectId(),
      booking: new Types.ObjectId(),
      reviewStatus: 'ACCEPTED',
      executionStatus: 'NOT_STARTED',
      quantity: 1,
      unitPriceVND: 100,
      amount: 100,
      billedInvoiceId,
      billedAt: new Date(),
    };
    const getOrCreateForBooking = vi.fn();
    const addCharge = vi.fn();
    const findById = vi.fn().mockReturnValue({ exec: async () => null });
    const service = new ServiceOrdersService(
      {
        findById: () => ({ select: () => ({ exec: async () => row }) }),
      } as never,
      {} as never,
      {} as never,
      { getOrCreateForBooking, addCharge } as never,
      {} as never,
      {} as never,
      { findById } as never,
    );
    const receptionist = { ...user, role: 'RECEPTIONIST' };
    await expect(
      service.assignees(String(row._id), receptionist),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      service.assign(String(row._id), { assigneeId: user.id }, receptionist),
    ).rejects.toMatchObject({ status: 409 });
    expect(findById).toHaveBeenCalledTimes(2);
    expect(findById).toHaveBeenCalledWith(billedInvoiceId);
    expect(getOrCreateForBooking).not.toHaveBeenCalled();
    expect(addCharge).not.toHaveBeenCalled();
  });

  it('enforces Customer inside service independently of HTTP guards', async () => {
    const service = new ServiceOrdersService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    await expect(
      service.create(dto, { ...user, role: 'MANAGER' }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(service.create(dto, undefined as never)).rejects.toMatchObject(
      { status: 401 },
    );
  });

  it('enforces exact Receptionist inside every staff service entry point', async () => {
    const service = new ServiceOrdersService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    for (const role of [
      'CUSTOMER',
      'MANAGER',
      'SERVICE_STAFF',
      'OPERATIONS_STAFF',
    ]) {
      const staff = { ...user, role };
      await expect(
        service.requests(new ListServiceOrdersQuery(), staff),
      ).rejects.toMatchObject({ status: 403 });
      await expect(
        service.requestDetail(dto.bookingId, staff),
      ).rejects.toMatchObject({ status: 403 });
      await expect(
        service.review(dto.bookingId, { decision: 'ACCEPT' }, staff),
      ).rejects.toMatchObject({ status: 403 });
    }
    await expect(
      service.review(dto.bookingId, { decision: 'ACCEPT' }, undefined as never),
    ).rejects.toMatchObject({ status: 401 });
  });

  it.each([null, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])(
    'rejects unusable billable price %s without creating',
    async (price) => {
      const create = vi.fn();
      const service = new ServiceOrdersService(
        { create } as never,
        model({ isActive: true, status: 'CHECKED_IN' }) as never,
        model({ isActive: true, billable: true, price }) as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
      );
      await expect(service.create(dto, user)).rejects.toMatchObject({
        status: 400,
      });
      expect(create).not.toHaveBeenCalled();
    },
  );
});
