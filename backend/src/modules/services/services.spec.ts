import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Model, model } from 'mongoose';
import {
  Service,
  ServiceSchema,
  SERVICE_COLLECTION_VALIDATOR,
} from './schemas/service.schema.js';
import { ListServicesQuery } from './dto/list-services.dto.js';
import { ServicesService } from './services.service.js';
import { SERVICE_SEED_SAMPLES } from './seed.js';
import { SEEDS } from '../../database/seed.js';

describe('UC53 Service H4 schema', () => {
  const Services = model<Service>('UC53UnitService', ServiceSchema);
  it('declares the exact unique name index, collection guard and defaults', async () => {
    expect(ServiceSchema.indexes()).toContainEqual([
      { name: 1 },
      { unique: true },
    ]);
    expect(ServiceSchema.options.collection).toBe('services');
    expect(ServiceSchema.options.collectionOptions).toMatchObject({
      validator: SERVICE_COLLECTION_VALIDATOR,
      validationLevel: 'strict',
      validationAction: 'error',
    });
    const row = new Services({
      name: '  Zero  ',
      description: ' note ',
      unit: ' lần ',
      price: 0,
    });
    await expect(row.validate()).resolves.toBeUndefined();
    expect(row.toObject()).toMatchObject({
      name: 'Zero',
      description: 'note',
      unit: 'lần',
      billable: true,
      price: 0,
      isActive: true,
    });
  });
  it.each([
    {},
    { name: '' },
    { name: '  ' },
    { name: 1 },
    { name: 'X', billable: 'true' },
    { name: 'X', billable: 1 },
    { name: 'X', billable: null },
    { name: 'X', price: -1 },
    { name: 'X', price: 1.5 },
    { name: 'X', price: '100' },
    { name: 'X', price: Number.NaN },
    { name: 'X', price: Number.POSITIVE_INFINITY },
    { name: 'X', price: Number.MAX_SAFE_INTEGER + 1 },
    { name: 'X' },
    { name: 'X', price: null },
    { name: 'X', billable: false, price: -1 },
    { name: 'X', isActive: false, price: 1.5 },
    { name: 'X', billable: false, unit: 1 },
    { name: 'X', billable: false, description: 1 },
  ])('rejects invalid schema %j', async (input) => {
    await expect(new Services(input).validate()).rejects.toThrow();
  });
  it.each([
    { name: 'Zero', price: 0 },
    { name: 'Draft', isActive: false },
    { name: 'Free', billable: false },
    { name: 'Free null', billable: false, price: null },
    { name: 'Boundary', price: Number.MAX_SAFE_INTEGER },
  ])('accepts valid price/status combination %j', async (input) => {
    const doc = new Services(input);
    await expect(doc.validate()).resolves.toBeUndefined();
    expect(doc.description).toBe('');
    expect(doc.unit).toBe('');
  });
  it('seeds every sample with valid H4 fields, zero, absent price, free and inactive cases in the required order', async () => {
    for (const sample of SERVICE_SEED_SAMPLES)
      await expect(new Services(sample).validate()).resolves.toBeUndefined();
    expect(
      SERVICE_SEED_SAMPLES.some((row) => row.billable && row.price === 0),
    ).toBe(true);
    expect(
      SERVICE_SEED_SAMPLES.some((row) => !row.billable && row.price === null),
    ).toBe(true);
    expect(SERVICE_SEED_SAMPLES.some((row) => !row.isActive)).toBe(true);
    expect(SERVICE_SEED_SAMPLES.some((row) => !row.unit)).toBe(true);
    expect(Object.keys(SEEDS)).toEqual([
      'roles',
      'users',
      'amenities',
      'room-types',
      'rooms',
      'equipment',
      'services',
      'bookings',
      'feedback',
    ]);
  });
});
describe('UC53 query validation', () => {
  it('defaults and transforms false without losing it', async () => {
    const query = plainToInstance(ListServicesQuery, {
      billable: 'false',
      isActive: 'false',
      page: '2',
      limit: '5',
    });
    expect(await validate(query)).toEqual([]);
    expect(query).toMatchObject({
      billable: false,
      isActive: false,
      page: 2,
      limit: 5,
      sortBy: 'name',
      sortOrder: 'asc',
    });
  });
  it.each([
    { page: 0 },
    { page: 1.5 },
    { limit: 0 },
    { limit: 1000 },
    { billable: 'yes' },
    { isActive: '0' },
    { search: [] },
    { search: 'x'.repeat(101) },
    { sortBy: 'unknown' },
    { sortOrder: 'up' },
    { unknown: 1 },
  ])('rejects query %j', async (input) => {
    expect(
      (
        await validate(plainToInstance(ListServicesQuery, input), {
          whitelist: true,
          forbidNonWhitelisted: true,
        })
      ).length,
    ).toBeGreaterThan(0);
  });
});
describe('UC53 ServicesService', () => {
  function setup(result: unknown = { items: [], count: [] }) {
    const exec = vi.fn().mockResolvedValue([result]);
    const services = { aggregate: vi.fn().mockReturnValue({ exec }) };
    return {
      service: new ServicesService(services as unknown as Model<Service>),
      services,
    };
  }
  it('uses one read aggregation with literal name/false filters and matching count/page', async () => {
    const items = [
      {
        id: 'id',
        name: 'A',
        description: '',
        unit: '',
        billable: false,
        price: null,
        isActive: false,
      },
    ];
    const { service, services } = setup({ items, count: [{ total: 11 }] });
    const result = await service.list(
      Object.assign(new ListServicesQuery(), {
        search: 'A.*[x]',
        billable: false,
        isActive: false,
        page: 2,
        limit: 5,
      }),
    );
    expect(result).toEqual({ items, total: 11, page: 2, limit: 5 });
    expect(services.aggregate).toHaveBeenCalledOnce();
    const pipeline = services.aggregate.mock.calls[0][0];
    expect(pipeline[0]).toEqual({
      $match: {
        name: { $regex: 'A\\.\\*\\[x\\]', $options: 'i' },
        billable: false,
        isActive: false,
      },
    });
    expect(pipeline[1].$facet.count).toEqual([{ $count: 'total' }]);
    expect(pipeline[1].$facet.items).toContainEqual({ $skip: 5 });
    expect(pipeline[1].$facet.items).toContainEqual({ $limit: 5 });
  });
  it.each(['name', 'createdAt'] as const)(
    'sorts %s descending with stable ID and no implicit active filter',
    async (sortBy) => {
      const { service, services } = setup();
      await service.list(
        Object.assign(new ListServicesQuery(), { sortBy, sortOrder: 'desc' }),
      );
      const pipeline = services.aggregate.mock.calls[0][0];
      expect(pipeline[0]).toEqual({ $match: {} });
      expect(pipeline[1].$facet.items[0]).toEqual({
        $sort: { [sortBy]: -1, _id: 1 },
      });
    },
  );
  it.each(['asc', 'desc'] as const)(
    'places missing/null prices last for %s sorting, before pagination',
    async (sortOrder) => {
      const { service, services } = setup();
      await service.list(
        Object.assign(new ListServicesQuery(), { sortBy: 'price', sortOrder }),
      );
      const stages = services.aggregate.mock.calls[0][0][1].$facet.items;
      expect(stages[0]).toEqual({
        $addFields: {
          _missingPrice: {
            $cond: [{ $eq: [{ $ifNull: ['$price', null] }, null] }, 1, 0],
          },
        },
      });
      expect(stages[1]).toEqual({
        $sort: {
          _missingPrice: 1,
          price: sortOrder === 'asc' ? 1 : -1,
          _id: 1,
        },
      });
      expect(stages[2]).toEqual({ $skip: 0 });
    },
  );
  it('returns a complete empty page and rejects unsafe skip without querying Mongo', async () => {
    const { service, services } = setup();
    expect(await service.list(new ListServicesQuery())).toEqual({
      items: [],
      total: 0,
      page: 1,
      limit: 10,
    });
    services.aggregate.mockClear();
    await expect(
      service.list(
        Object.assign(new ListServicesQuery(), {
          page: Number.MAX_SAFE_INTEGER,
          limit: 100,
        }),
      ),
    ).rejects.toThrow('pagination');
    expect(services.aggregate).not.toHaveBeenCalled();
  });
});
