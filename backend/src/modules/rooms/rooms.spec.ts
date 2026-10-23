import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Logger } from '@nestjs/common';
import { Model, Types, model } from 'mongoose';
import { RoomStatus } from '../../common/constants/room-status.enum.js';
import { Room, RoomSchema } from './schemas/room.schema.js';
import { ListRoomsQuery } from './dto/list-rooms.dto.js';
import { RoomsService } from './rooms.service.js';

const roomType = new Types.ObjectId();
const valid = { roomNumber: ' 101 ', floor: 1, roomType };
describe('UC47 Room schema and query', () => {
  const Rooms = model<Room>('UC47UnitRoom', RoomSchema);
  it('has exactly four statuses and the RoomType relationship without copied capacities/amenities', async () => {
    expect(Object.values(RoomStatus)).toEqual([
      'AVAILABLE',
      'OCCUPIED',
      'CLEANING',
      'MAINTENANCE',
    ]);
    const room = new Rooms(valid);
    await expect(room.validate()).resolves.toBeUndefined();
    expect(room.roomNumber).toBe('101');
    expect(room.status).toBe(RoomStatus.Available);
    expect(room.notes).toBe('');
    expect(room.isActive).toBe(true);
    expect(RoomSchema.indexes()).toContainEqual([
      { roomNumber: 1 },
      { unique: true },
    ]);
    expect(RoomSchema.path('roomType').options.ref).toBe('RoomType');
    for (const field of [
      'amenities',
      'capacity',
      'adultCapacity',
      'childCapacity',
      'basePrice',
    ])
      expect(RoomSchema.path(field)).toBeUndefined();
    await expect(
      new Rooms({ ...valid, floor: -1, notes: ' test ' }).validate(),
    ).resolves.toBeUndefined();
    expect(new Rooms({ ...valid, notes: ' test ' }).notes).toBe('test');
  });
  it.each([
    { roomNumber: undefined },
    { roomNumber: ' ' },
    { roomType: undefined },
    { roomType: 'bad' },
    { status: 'RESERVED' },
    { status: 'OUT_OF_SERVICE' },
    { status: null },
    { floor: 1.5 },
    { floor: undefined },
  ])('rejects invalid schema %j', async (change) => {
    await expect(
      new Rooms({ ...valid, ...change }).validate(),
    ).rejects.toThrow();
  });
  it('transforms query strings including false and floor zero', async () => {
    const query = plainToInstance(ListRoomsQuery, {
      roomTypeId: String(roomType),
      floor: '0',
      isActive: 'false',
      page: '2',
      limit: '5',
      status: 'CLEANING',
      sortBy: 'floor',
      sortOrder: 'desc',
    });
    expect(await validate(query)).toEqual([]);
    expect(query).toMatchObject({
      floor: 0,
      isActive: false,
      page: 2,
      limit: 5,
    });
    expect(new ListRoomsQuery()).toMatchObject({
      page: 1,
      limit: 10,
      sortBy: 'roomNumber',
      sortOrder: 'asc',
    });
  });
  it.each([
    { page: 0 },
    { page: 1.5 },
    { limit: 1000 },
    { limit: 0 },
    { roomTypeId: 'bad' },
    { roomTypeId: ['bad'] },
    { status: 'RESERVED' },
    { floor: 1.5 },
    { floor: 'bad' },
    { isActive: 'yes' },
    { sortBy: 'name' },
    { sortOrder: 'up' },
    { search: ['bad'] },
  ])('rejects invalid query %j', async (query) => {
    expect(
      (await validate(plainToInstance(ListRoomsQuery, query))).length,
    ).toBeGreaterThan(0);
  });
});

describe('UC47 RoomsService', () => {
  function setup(rows: unknown[] = []) {
    const chain = {
      collation: vi.fn(),
      sort: vi.fn(),
      skip: vi.fn(),
      limit: vi.fn(),
      populate: vi.fn(),
      lean: vi.fn(),
      exec: vi.fn().mockResolvedValue(rows),
    };
    for (const field of [
      'collation',
      'sort',
      'skip',
      'limit',
      'populate',
      'lean',
    ] as const)
      chain[field].mockReturnValue(chain);
    const count = {
      collation: vi.fn(),
      exec: vi.fn().mockResolvedValue(rows.length),
    };
    count.collation.mockReturnValue(count);
    const roomModel = {
      find: vi.fn().mockReturnValue(chain),
      countDocuments: vi.fn().mockReturnValue(count),
    };
    return {
      service: new RoomsService(roomModel as unknown as Model<Room>),
      chain,
      count,
      roomModel,
    };
  }
  afterEach(() => vi.restoreAllMocks());
  it('filters literal roomNumber, RoomType, status, inactive, floor and paginates with numeric collation', async () => {
    const { service, chain, count, roomModel } = setup();
    await service.list(
      Object.assign(new ListRoomsQuery(), {
        search: 'a.*[1]',
        roomTypeId: String(roomType),
        status: RoomStatus.Cleaning,
        floor: 0,
        isActive: false,
        page: 3,
        limit: 5,
      }),
    );
    const filter = roomModel.find.mock.calls[0][0];
    expect(
      new RegExp(filter.roomNumber.$regex, filter.roomNumber.$options).test(
        'A.*[1]',
      ),
    ).toBe(true);
    expect(
      new RegExp(filter.roomNumber.$regex, filter.roomNumber.$options).test(
        'aaaa1',
      ),
    ).toBe(false);
    expect(filter).toMatchObject({
      roomType,
      status: RoomStatus.Cleaning,
      floor: 0,
      isActive: false,
    });
    expect(roomModel.countDocuments).toHaveBeenCalledWith(filter);
    expect(chain.collation).toHaveBeenCalledWith({
      locale: 'en',
      numericOrdering: true,
    });
    expect(count.collation).toHaveBeenCalledWith({
      locale: 'en',
      numericOrdering: true,
    });
    expect(chain.skip).toHaveBeenCalledWith(10);
    expect(chain.limit).toHaveBeenCalledWith(5);
    expect(chain.populate).toHaveBeenCalledWith('roomType', 'name isActive');
  });
  it.each(['roomNumber', 'floor', 'status'])(
    'sorts %s with stable _id tie breaker',
    async (sortBy) => {
      const { service, chain } = setup();
      await service.list(
        Object.assign(new ListRoomsQuery(), { sortBy, sortOrder: 'desc' }),
      );
      expect(chain.sort).toHaveBeenCalledWith({ [sortBy]: -1, _id: 1 });
    },
  );
  it('does not filter inactive implicitly and returns an empty list', async () => {
    const { service, roomModel } = setup();
    expect(await service.list(new ListRoomsQuery())).toEqual({
      items: [],
      total: 0,
      page: 1,
      limit: 10,
    });
    expect(roomModel.find).toHaveBeenCalledWith({});
  });
  it('keeps missing/inactive RoomTypes safe, logs a missing reference, and projects only public fields', async () => {
    const warn = vi
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => {});
    const row = {
      _id: new Types.ObjectId(),
      roomNumber: '101',
      floor: 1,
      roomType: {
        _id: roomType,
        name: 'Suite',
        isActive: false,
        basePrice: 999,
      },
      status: RoomStatus.Available,
      isActive: false,
      notes: '',
      privateField: 'secret',
    };
    const { service } = setup([
      row,
      { ...row, roomType: null, notes: undefined },
    ]);
    const result = await service.list(new ListRoomsQuery());
    expect(result.items[0].roomType).toEqual({
      id: String(roomType),
      name: 'Suite',
      isActive: false,
    });
    expect(result.items[0]).not.toHaveProperty('privateField');
    expect(result.items[1]).toMatchObject({ roomType: null, notes: '' });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(row.roomType.basePrice).toBe(999);
  });
});
