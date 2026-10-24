import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Types } from 'mongoose';
import {
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

  it('enforces Customer inside service independently of HTTP guards', async () => {
    const service = new ServiceOrdersService(
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

  it.each([null, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])(
    'rejects unusable billable price %s without creating',
    async (price) => {
      const create = vi.fn();
      const service = new ServiceOrdersService(
        { create } as never,
        model({ isActive: true, status: 'CHECKED_IN' }) as never,
        model({ isActive: true, billable: true, price }) as never,
      );
      await expect(service.create(dto, user)).rejects.toMatchObject({
        status: 400,
      });
      expect(create).not.toHaveBeenCalled();
    },
  );
});
