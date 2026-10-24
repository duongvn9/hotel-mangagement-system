import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Model, Types } from 'mongoose';
import { AmenitiesService } from './amenities.service.js';
import { Amenity } from './schemas/amenity.schema.js';
import {
  RoomType,
  RoomTypeSchema,
} from '../room-types/schemas/room-type.schema.js';
import { ListAmenitiesQuery } from './dto/list-amenities.dto.js';
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
  const amenities = {
    find: vi.fn().mockReturnValue(list),
    countDocuments: vi.fn().mockReturnValue(chain(total)),
  };
  const roomTypes = { find: vi.fn().mockReturnValue(related) };
  return {
    service: new AmenitiesService(
      amenities as unknown as Model<Amenity>,
      roomTypes as unknown as Model<RoomType>,
    ),
    amenities,
    roomTypes,
    list,
    related,
  };
}
const id = new Types.ObjectId();
const second = new Types.ObjectId();
const row = {
  _id: id,
  name: 'Wi-Fi',
  description: 'Internet',
  isActive: false,
};
describe('UC51 service and query', () => {
  it('filters escaped literal name and false, paginates and counts with the same filter', async () => {
    const { service, amenities, list } = setup();
    await service.list(
      Object.assign(new ListAmenitiesQuery(), {
        search: 'Wi.*[x]',
        isActive: false,
        page: 3,
        limit: 5,
      }),
    );
    const filter = amenities.find.mock.calls[0][0];
    expect(filter.isActive).toBe(false);
    expect(
      new RegExp(filter.name.$regex, filter.name.$options).test('WI.*[x]'),
    ).toBe(true);
    expect(
      new RegExp(filter.name.$regex, filter.name.$options).test('Wifi x'),
    ).toBe(false);
    expect(amenities.countDocuments).toHaveBeenCalledWith(filter);
    expect(list.skip).toHaveBeenCalledWith(10);
    expect(list.limit).toHaveBeenCalledWith(5);
    expect(list.sort).toHaveBeenCalledWith({ name: 1, _id: 1 });
  });
  it.each(['name', 'createdAt'])(
    'supports descending %s with stable tie breaker',
    async (sortBy) => {
      const { service, list } = setup();
      await service.list(
        Object.assign(new ListAmenitiesQuery(), { sortBy, sortOrder: 'desc' }),
      );
      expect(list.sort).toHaveBeenCalledWith({ [sortBy]: -1, _id: 1 });
    },
  );
  it('does not filter inactive implicitly and skips RoomType query for empty page', async () => {
    const { service, amenities, roomTypes } = setup();
    expect(await service.list(new ListAmenitiesQuery())).toEqual({
      items: [],
      total: 0,
      page: 1,
      limit: 10,
    });
    expect(amenities.find).toHaveBeenCalledWith({});
    expect(roomTypes.find).not.toHaveBeenCalled();
  });
  it('groups reverse references in one query, includes inactive types, ignores orphan references and deduplicates legacy refs', async () => {
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
          amenities: [id, id, new Types.ObjectId()],
        },
        { _id: typeB, name: 'B', isActive: false, amenities: [id] },
      ],
    );
    const result = await service.list(new ListAmenitiesQuery());
    expect(result.items[0]).toEqual({
      id: String(id),
      name: 'Wi-Fi',
      description: 'Internet',
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
      amenities: { $in: [id, second] },
    });
    expect(related.select).toHaveBeenCalledWith('name isActive amenities');
    expect(related.sort).toHaveBeenCalledWith({ name: 1, _id: 1 });
  });
  it.each([1, 10, 100])(
    'uses only one RoomType query for %i amenities',
    async (count) => {
      const { service, roomTypes } = setup(
        Array.from({ length: count }, () => ({
          ...row,
          _id: new Types.ObjectId(),
        })),
      );
      await service.list(new ListAmenitiesQuery());
      expect(roomTypes.find).toHaveBeenCalledOnce();
    },
  );
  it('declares the reverse lookup multikey index without another relationship', () => {
    expect(RoomTypeSchema.indexes()).toContainEqual([{ amenities: 1 }, {}]);
  });
  it('transforms false and pagination with defaults', async () => {
    const query = plainToInstance(ListAmenitiesQuery, {
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
        await validate(plainToInstance(ListAmenitiesQuery, input), {
          whitelist: true,
          forbidNonWhitelisted: true,
        })
      ).length,
    ).toBeGreaterThan(0);
  });
});
