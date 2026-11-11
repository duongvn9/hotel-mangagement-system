import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Model, Types } from 'mongoose';
import { BedTypesService } from './bed-types.service.js';
import { BedType } from './schemas/bed-type.schema.js';
import {
  RoomType,
  RoomTypeSchema,
} from '../room-types/schemas/room-type.schema.js';
import { ListBedTypesQuery } from './dto/list-bed-types.dto.js';

function chain(rows: unknown) {
  const value = {
    sort: vi.fn(),
    select: vi.fn(),
    skip: vi.fn(),
    limit: vi.fn(),
    lean: vi.fn(),
    exec: vi.fn().mockResolvedValue(rows),
  };
  for (const key of ['sort', 'select', 'skip', 'limit', 'lean'] as const)
    value[key].mockReturnValue(value);
  return value;
}

function setup(
  rows: unknown[] = [],
  types: unknown[] = [],
  total = rows.length,
) {
  const list = chain(rows);
  const related = chain(types);
  const bedTypes = {
    find: vi.fn().mockReturnValue(list),
    countDocuments: vi.fn().mockReturnValue(chain(total)),
  };
  const roomTypes = { find: vi.fn().mockReturnValue(related) };
  return {
    service: new BedTypesService(
      bedTypes as unknown as Model<BedType>,
      roomTypes as unknown as Model<RoomType>,
    ),
    bedTypes,
    roomTypes,
    list,
    related,
  };
}

const id = new Types.ObjectId();
const second = new Types.ObjectId();
const row = {
  _id: id,
  name: 'Giường đôi',
  description: 'Hai người',
  isActive: false,
};

describe('bed types list and query', () => {
  it('filters escaped literal name and false, paginates and counts with the same filter', async () => {
    const { service, bedTypes, list } = setup();
    await service.list(
      Object.assign(new ListBedTypesQuery(), {
        search: 'Gi.*[x]',
        isActive: false,
        page: 3,
        limit: 5,
      }),
    );
    const filter = bedTypes.find.mock.calls[0][0];
    expect(filter.isActive).toBe(false);
    expect(
      new RegExp(filter.name.$regex, filter.name.$options).test('GI.*[x]'),
    ).toBe(true);
    expect(
      new RegExp(filter.name.$regex, filter.name.$options).test('Giuong x'),
    ).toBe(false);
    expect(bedTypes.countDocuments).toHaveBeenCalledWith(filter);
    expect(list.skip).toHaveBeenCalledWith(10);
    expect(list.limit).toHaveBeenCalledWith(5);
    expect(list.sort).toHaveBeenCalledWith({ name: 1, _id: 1 });
  });

  it.each(['name', 'createdAt'])(
    'supports descending %s with stable tie breaker',
    async (sortBy) => {
      const { service, list } = setup();
      await service.list(
        Object.assign(new ListBedTypesQuery(), { sortBy, sortOrder: 'desc' }),
      );
      expect(list.sort).toHaveBeenCalledWith({ [sortBy]: -1, _id: 1 });
    },
  );

  it('does not filter inactive implicitly and skips RoomType query for empty page', async () => {
    const { service, bedTypes, roomTypes } = setup();
    expect(await service.list(new ListBedTypesQuery())).toEqual({
      items: [],
      total: 0,
      page: 1,
      limit: 10,
    });
    expect(bedTypes.find).toHaveBeenCalledWith({});
    expect(roomTypes.find).not.toHaveBeenCalled();
  });

  it('groups reverse references in one query, includes inactive types, ignores orphan references and deduplicates', async () => {
    const typeA = new Types.ObjectId();
    const typeB = new Types.ObjectId();
    const { service, roomTypes, related } = setup(
      [
        row,
        {
          ...row,
          _id: second,
          name: 'Unused',
          isActive: true,
          description: undefined,
        },
      ],
      [
        {
          _id: typeA,
          name: 'A',
          isActive: true,
          beds: [
            { bedType: id, quantity: 2 },
            { bedType: id, quantity: 1 },
            { bedType: new Types.ObjectId(), quantity: 1 },
          ],
        },
        {
          _id: typeB,
          name: 'B',
          isActive: false,
          beds: [{ bedType: id, quantity: 1 }],
        },
      ],
    );
    const result = await service.list(new ListBedTypesQuery());
    expect(result.items[0]).toEqual({
      id: String(id),
      name: 'Giường đôi',
      description: 'Hai người',
      isActive: false,
      roomTypes: [
        { id: String(typeA), name: 'A', isActive: true },
        { id: String(typeB), name: 'B', isActive: false },
      ],
      roomTypeCount: 2,
    });
    expect(result.items[1]).toMatchObject({
      description: '',
      roomTypes: [],
      roomTypeCount: 0,
    });
    expect(roomTypes.find).toHaveBeenCalledOnce();
    expect(roomTypes.find).toHaveBeenCalledWith({
      'beds.bedType': { $in: [id, second] },
    });
    expect(related.select).toHaveBeenCalledWith('name isActive beds');
    expect(related.sort).toHaveBeenCalledWith({ name: 1, _id: 1 });
  });

  it.each([1, 10, 100])(
    'uses only one RoomType query for %i bed types',
    async (count) => {
      const { service, roomTypes } = setup(
        Array.from({ length: count }, () => ({
          ...row,
          _id: new Types.ObjectId(),
        })),
      );
      await service.list(new ListBedTypesQuery());
      expect(roomTypes.find).toHaveBeenCalledOnce();
    },
  );

  it('declares the reverse lookup multikey index', () => {
    expect(RoomTypeSchema.indexes()).toContainEqual([
      { 'beds.bedType': 1 },
      {},
    ]);
  });

  it('transforms false and pagination with defaults', async () => {
    const query = plainToInstance(ListBedTypesQuery, {
      isActive: 'false',
      page: '2',
      limit: '5',
    });
    expect(await validate(query)).toEqual([]);
    expect(query).toMatchObject({
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
    { limit: 1000 },
    { limit: 0 },
    { isActive: 'yes' },
    { sortBy: 'bad' },
    { sortOrder: 'bad' },
    { search: [] },
    { unknown: 'x' },
  ])('rejects bad query %j', async (input) => {
    expect(
      (
        await validate(plainToInstance(ListBedTypesQuery, input), {
          whitelist: true,
          forbidNonWhitelisted: true,
        })
      ).length,
    ).toBeGreaterThan(0);
  });
});
