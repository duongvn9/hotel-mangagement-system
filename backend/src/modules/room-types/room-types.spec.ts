import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Model, Types, model } from 'mongoose';
import { ListRoomTypesQuery } from './dto/list-room-types.dto.js';
import { RoomType, RoomTypeSchema } from './schemas/room-type.schema.js';
import { AmenitySchema } from '../amenities/schemas/amenity.schema.js';
import { RoomTypesService } from './room-types.service.js';

describe('UC49 query and schema', () => {
  const RoomTypes = model<RoomType>('UC49UnitRoomType', RoomTypeSchema);
  const Amenities = model('UC49UnitAmenity', AmenitySchema);
  const valid = { name: 'Standard', capacity: 2, basePrice: 850000 };
  it.each([
    { capacity: 0 },
    { capacity: -1 },
    { capacity: 1.5 },
    { basePrice: 0 },
    { basePrice: -1 },
    { basePrice: 1.5 },
    { basePrice: Number.MAX_SAFE_INTEGER + 1 },
    { name: '' },
  ])('rejects invalid schema %j', async (change) => {
    await expect(
      new RoomTypes({ ...valid, ...change }).validate(),
    ).rejects.toThrow();
  });
  it('rejects duplicate amenity references; accepts empty amenities', async () => {
    const id = new Types.ObjectId();
    await expect(
      new RoomTypes({ ...valid, amenities: [id, id] }).validate(),
    ).rejects.toThrow();
    await expect(new RoomTypes(valid).validate()).resolves.toBeUndefined();
    expect(RoomTypeSchema.indexes()).toContainEqual([
      { name: 1 },
      { unique: true },
    ]);
    expect(AmenitySchema.indexes()).toContainEqual([
      { name: 1 },
      { unique: true },
    ]);
    await expect(new Amenities({ name: '' }).validate()).rejects.toThrow();
  });
  it('defaults and transforms supported query values', async () => {
    const query = plainToInstance(ListRoomTypesQuery, {
      isActive: 'false',
      page: '2',
      limit: '5',
      sortBy: 'capacity',
      sortOrder: 'desc',
    });
    expect(await validate(query)).toEqual([]);
    expect(query).toMatchObject({ isActive: false, page: 2, limit: 5 });
    expect(new ListRoomTypesQuery()).toMatchObject({
      page: 1,
      limit: 10,
      sortBy: 'name',
      sortOrder: 'asc',
    });
  });
  it.each([
    { page: 0 },
    { page: 1.2 },
    { limit: 1000 },
    { limit: 0 },
    { isActive: 'yes' },
    { sortBy: 'password' },
    { sortOrder: 'down' },
    { search: ['a'] },
  ])('rejects bad query %j', async (query) => {
    expect(
      (await validate(plainToInstance(ListRoomTypesQuery, query))).length,
    ).toBeGreaterThan(0);
  });
});

describe('RoomTypesService', () => {
  function setup(rows: unknown[] = []) {
    const chain = {
      sort: vi.fn(),
      skip: vi.fn(),
      limit: vi.fn(),
      populate: vi.fn(),
      lean: vi.fn(),
      exec: vi.fn().mockResolvedValue(rows),
    };
    for (const key of ['sort', 'skip', 'limit', 'populate', 'lean'] as const)
      chain[key].mockReturnValue(chain);
    const modelMock = {
      find: vi.fn().mockReturnValue(chain),
      countDocuments: vi
        .fn()
        .mockReturnValue({ exec: vi.fn().mockResolvedValue(rows.length) }),
    };
    return {
      service: new RoomTypesService(modelMock as unknown as Model<RoomType>),
      modelMock,
      chain,
    };
  }
  it('escapes regex search, filters inactive, applies stable sort and pagination', async () => {
    const { service, chain, modelMock } = setup();
    await service.list(
      Object.assign(new ListRoomTypesQuery(), {
        search: 'A.*+[x](?)',
        isActive: false,
        page: 3,
        limit: 5,
        sortBy: 'basePrice',
        sortOrder: 'desc',
      }),
    );
    const filter = modelMock.find.mock.calls[0][0];
    const expression = new RegExp(filter.name.$regex, filter.name.$options);
    expect(expression.test('a.*+[X](?)')).toBe(true);
    expect(expression.test('AAAAx')).toBe(false);
    expect(filter.isActive).toBe(false);
    expect(modelMock.countDocuments).toHaveBeenCalledWith(filter);
    expect(chain.sort).toHaveBeenCalledWith({ basePrice: -1, _id: 1 });
    expect(chain.skip).toHaveBeenCalledWith(10);
    expect(chain.limit).toHaveBeenCalledWith(5);
    expect(chain.populate).toHaveBeenCalledWith('amenities', 'name');
  });
  it('returns empty list and no implicit active filter', async () => {
    const { service, modelMock } = setup();
    expect(await service.list(new ListRoomTypesQuery())).toEqual({
      items: [],
      total: 0,
      page: 1,
      limit: 10,
    });
    expect(modelMock.find).toHaveBeenCalledWith({});
  });
  it('projects safe fields and derives booking availability, including invalid legacy data', async () => {
    const base = {
      _id: new Types.ObjectId(),
      name: 'Standard',
      description: '',
      capacity: 2,
      basePrice: 850000,
      isActive: true,
      amenities: [
        null,
        { _id: new Types.ObjectId(), name: 'Wi-Fi', description: 'private' },
      ],
      privateField: 'secret',
    };
    const rows = [
      base,
      { ...base, isActive: false },
      { ...base, capacity: 1.5 },
      { ...base, capacity: 0 },
      { ...base, basePrice: 0 },
      { ...base, basePrice: 1.5 },
    ];
    const { service } = setup(rows);
    const result = await service.list(new ListRoomTypesQuery());
    expect(result.items.map((item) => item.availableForBooking)).toEqual([
      true,
      false,
      false,
      false,
      false,
      false,
    ]);
    expect(result.items[0].amenities).toEqual([
      { id: String(base.amenities[1]!._id), name: 'Wi-Fi' },
    ]);
    expect(result.items[0]).not.toHaveProperty('privateField');
  });
});
