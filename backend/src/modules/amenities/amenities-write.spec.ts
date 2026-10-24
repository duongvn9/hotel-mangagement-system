import {
  BadRequestException,
  ConflictException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Model, Types } from 'mongoose';
import { AmenitiesService } from './amenities.service.js';
import { Amenity } from './schemas/amenity.schema.js';
import { RoomType } from '../room-types/schemas/room-type.schema.js';
import { CreateAmenityDto, UpdateAmenityDto } from './dto/write-amenity.dto.js';

const id = new Types.ObjectId();
const a = new Types.ObjectId();
const b = new Types.ObjectId();
const c = new Types.ObjectId();
function query(get: () => unknown) {
  const value = {
    select: vi.fn(),
    sort: vi.fn(),
    lean: vi.fn(),
    exec: vi.fn(async () => get()),
  };
  for (const key of ['select', 'sort', 'lean'] as const)
    value[key].mockReturnValue(value);
  return value;
}
function setup() {
  const state = {
    amenity: {
      _id: id,
      name: 'Wi-Fi',
      description: 'Old',
      isActive: true,
    } as Record<string, unknown> | null,
    types: [a, b, c].map((_id, index) => ({
      _id,
      name: String(index),
      isActive: index !== 2,
      amenities: [] as string[],
    })),
    partial: false,
  };
  const amenities = {
    exists: vi.fn(async () => null as unknown),
    findById: vi.fn(() => query(() => state.amenity && { ...state.amenity })),
    create: vi.fn(async (fields: Record<string, unknown>) => {
      state.amenity = { _id: id, ...fields };
      return state.amenity;
    }),
    deleteOne: vi.fn(async () => {
      state.amenity = null;
    }),
    findOneAndUpdate: vi.fn(
      (_filter: unknown, update: { $set: Record<string, unknown> }) =>
        query(() => {
          Object.assign(state.amenity!, update.$set);
          return state.amenity;
        }),
    ),
  };
  type Operation = {
    updateOne: {
      filter: { _id: Types.ObjectId; isActive?: boolean };
      update: {
        $addToSet?: { amenities: Types.ObjectId };
        $pull?: { amenities: Types.ObjectId };
      };
    };
  };
  const roomTypes = {
    find: vi.fn(
      (filter: {
        amenities?: Types.ObjectId;
        _id?: { $in: string[] };
        isActive?: boolean;
      }) =>
        query(() =>
          state.types.filter((type) =>
            filter.amenities
              ? type.amenities.includes(String(filter.amenities))
              : filter._id!.$in.includes(String(type._id)) && type.isActive,
          ),
        ),
    ),
    updateMany: vi.fn(async () => {
      for (const type of state.types)
        type.amenities = type.amenities.filter((value) => value !== String(id));
    }),
    bulkWrite: vi.fn(async (operations: Operation[]) => {
      let matchedCount = 0;
      for (const { updateOne: op } of operations) {
        const type = state.types.find(
          (type) =>
            String(type._id) === String(op.filter._id) &&
            (op.filter.isActive === undefined || type.isActive),
        );
        if (type) {
          matchedCount++;
          if (op.update.$addToSet && !type.amenities.includes(String(id)))
            type.amenities.push(String(id));
          if (op.update.$pull)
            type.amenities = type.amenities.filter(
              (value) => value !== String(id),
            );
        }
        if (state.partial) {
          state.partial = false;
          throw new Error('Injected partial write');
        }
      }
      return { matchedCount };
    }),
  };
  return {
    state,
    amenities,
    roomTypes,
    service: new AmenitiesService(
      amenities as unknown as Model<Amenity>,
      roomTypes as unknown as Model<RoomType>,
    ),
  };
}
describe('UC52 write DTOs', () => {
  it('trims fields, accepts defaults and a partial PATCH', async () => {
    const dto = plainToInstance(CreateAmenityDto, {
      name: '  Wi-Fi  ',
      description: ' note ',
      roomTypeIds: [String(a)],
    });
    expect(await validate(dto)).toEqual([]);
    expect(dto).toMatchObject({ name: 'Wi-Fi', description: 'note' });
    expect(
      await validate(plainToInstance(UpdateAmenityDto, { description: '  ' })),
    ).toEqual([]);
  });
  it.each([
    {},
    { name: '' },
    { name: '   ' },
    { name: 'x'.repeat(101) },
    { name: 1 },
    { name: 'ok', description: null },
    { name: 'ok', isActive: 'true' },
    { name: 'ok', roomTypeIds: [String(a), String(a)] },
    { name: 'ok', roomTypeIds: ['ABCDEF0123456789ABCDEF01'] },
    { name: 'ok', roomTypeIds: ['no'] },
    { name: 'ok', roomTypeIds: null },
    { name: 'ok', roomTypeIds: 'no' },
    { name: 'ok', _id: String(id) },
    { name: 'ok', createdAt: 'now' },
  ])('rejects invalid create %j', async (input) => {
    expect(
      (
        await validate(plainToInstance(CreateAmenityDto, input), {
          whitelist: true,
          forbidNonWhitelisted: true,
        })
      ).length,
    ).toBeGreaterThan(0);
  });
  it.each(['name', 'description', 'isActive', 'roomTypeIds'])(
    'rejects null PATCH %s',
    async (field) => {
      expect(
        (await validate(plainToInstance(UpdateAmenityDto, { [field]: null })))
          .length,
      ).toBeGreaterThan(0);
    },
  );
});
describe('UC52 write service', () => {
  beforeEach(() =>
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {}),
  );
  afterEach(() => vi.restoreAllMocks());
  it.each([{ roomTypeIds: [] }, { roomTypeIds: [String(a), String(b)] }])(
    'creates with target %j, public response and defaults',
    async ({ roomTypeIds }) => {
      const { service, amenities, roomTypes, state } = setup();
      const result = await service.create({ name: 'New', roomTypeIds });
      expect(result).toMatchObject({
        id: String(id),
        name: 'New',
        description: '',
        isActive: true,
        roomTypeCount: roomTypeIds.length,
      });
      expect(amenities.create).toHaveBeenCalledWith({
        name: 'New',
        description: '',
        isActive: true,
      });
      expect(state.types.flatMap((type) => type.amenities)).toHaveLength(
        roomTypeIds.length,
      );
      expect(roomTypes.bulkWrite).toHaveBeenCalledTimes(
        roomTypeIds.length ? 1 : 0,
      );
    },
  );
  it.each([
    { roomTypeIds: [String(c)] },
    { roomTypeIds: [String(new Types.ObjectId())] },
    { roomTypeIds: [String(a), String(a)] },
    { roomTypeIds: ['bad'] },
  ])(
    'rejects invalid new targets %j before every write',
    async ({ roomTypeIds }) => {
      const { service, amenities, roomTypes } = setup();
      await expect(
        service.create({ name: 'New', roomTypeIds }),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        service.update(String(id), { name: 'Changed', roomTypeIds }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(amenities.create).not.toHaveBeenCalled();
      expect(amenities.findOneAndUpdate).not.toHaveBeenCalled();
      expect(roomTypes.bulkWrite).not.toHaveBeenCalled();
    },
  );
  it('handles name precheck and unique-index races before relationship writes', async () => {
    const { service, amenities, roomTypes } = setup();
    amenities.exists.mockResolvedValueOnce({ _id: id });
    await expect(service.create({ name: 'Wi-Fi' })).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(amenities.create).not.toHaveBeenCalled();
    amenities.create.mockRejectedValueOnce({ code: 11000 });
    await expect(
      service.create({ name: 'Race', roomTypeIds: [String(a)] }),
    ).rejects.toBeInstanceOf(ConflictException);
    amenities.findOneAndUpdate.mockReturnValueOnce(
      query(() => {
        throw { code: 11000 };
      }),
    );
    await expect(
      service.update(String(id), { name: 'Race', roomTypeIds: [String(a)] }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(roomTypes.bulkWrite).not.toHaveBeenCalled();
  });
  it('preserves omitted fields/relationships; uses exact name and self exclusion', async () => {
    const { service, amenities, roomTypes, state } = setup();
    state.types[2].amenities = [String(id)];
    await service.update(String(id), { name: 'Wi-Fi' });
    expect(amenities.exists).toHaveBeenCalledWith({
      name: 'Wi-Fi',
      _id: { $ne: String(id) },
    });
    expect(amenities.findOneAndUpdate.mock.calls[0][1]).toEqual({
      $set: { name: 'Wi-Fi' },
    });
    expect(state.amenity?.description).toBe('Old');
    expect(state.types[2].amenities).toEqual([String(id)]);
    expect(roomTypes.bulkWrite).not.toHaveBeenCalled();
  });
  it('retains inactive links, adds/removes via operators and preserves unrelated refs', async () => {
    const { service, roomTypes, state } = setup();
    const unrelated = String(new Types.ObjectId());
    state.types[0].amenities = [String(id), unrelated];
    state.types[2].amenities = [String(id)];
    await service.update(String(id), { roomTypeIds: [String(b), String(c)] });
    expect(state.types.map((type) => type.amenities)).toEqual([
      [unrelated],
      [String(id)],
      [String(id)],
    ]);
    const ops = roomTypes.bulkWrite.mock.calls[0][0];
    expect(ops).toHaveLength(2);
    expect(ops[0].updateOne.update).toEqual({ $addToSet: { amenities: id } });
    expect(ops[1].updateOne.update).toEqual({ $pull: { amenities: id } });
    await service.update(String(id), { roomTypeIds: [] });
    expect(state.types[2].amenities).toEqual([]);
  });
  it('inactive amenity cannot receive new links; allows removal, metadata and reactivation', async () => {
    const { service, amenities, roomTypes, state } = setup();
    await expect(
      service.create({
        name: 'Off',
        isActive: false,
        roomTypeIds: [String(a)],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    state.amenity!.isActive = false;
    state.types[2].amenities = [String(id)];
    await expect(
      service.update(String(id), {
        description: 'Bad',
        roomTypeIds: [String(a)],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(amenities.findOneAndUpdate).not.toHaveBeenCalled();
    expect(roomTypes.bulkWrite).not.toHaveBeenCalled();
    await service.update(String(id), { description: 'Good', roomTypeIds: [] });
    expect(state.amenity?.description).toBe('Good');
    expect(state.types[2].amenities).toEqual([]);
    await service.update(String(id), {
      isActive: true,
      roomTypeIds: [String(a)],
    });
    expect(state.types[0].amenities).toEqual([String(id)]);
  });
  it('deactivation is idempotent and retains record and links', async () => {
    const { service, state } = setup();
    state.types[0].amenities = [String(id)];
    await service.update(String(id), { isActive: false });
    await service.update(String(id), { isActive: false });
    expect(state.amenity?.isActive).toBe(false);
    expect(state.types[0].amenities).toEqual([String(id)]);
  });
  it('compensates partial creation: pulls only new ID before deleting its record', async () => {
    const { service, amenities, roomTypes, state } = setup();
    const other = String(new Types.ObjectId());
    state.types[0].amenities = [other];
    state.partial = true;
    await expect(
      service.create({ name: 'New', roomTypeIds: [String(a), String(b)] }),
    ).rejects.toThrow('đã hoàn tác');
    expect(state.amenity).toBeNull();
    expect(state.types[0].amenities).toEqual([other]);
    expect(state.types[1].amenities).toEqual([]);
    expect(roomTypes.updateMany).toHaveBeenCalledWith(
      { amenities: id },
      { $pull: { amenities: id } },
    );
    expect(amenities.deleteOne).toHaveBeenCalledWith({ _id: String(id) });
    expect(roomTypes.updateMany.mock.invocationCallOrder[0]).toBeLessThan(
      amenities.deleteOne.mock.invocationCallOrder[0],
    );
  });
  it('does not orphan refs when compensation itself is unavailable', async () => {
    const { service, amenities, roomTypes, state } = setup();
    state.partial = true;
    roomTypes.updateMany.mockRejectedValueOnce(new Error('Offline'));
    await expect(
      service.create({ name: 'New', roomTypeIds: [String(a)] }),
    ).rejects.toThrow('Bù trừ chưa hoàn tất');
    expect(amenities.deleteOne).not.toHaveBeenCalled();
    expect(state.amenity).not.toBeNull();
  });
  it('reports partial update and replay converges without duplicates or lost unrelated refs', async () => {
    const { service, state } = setup();
    const other = String(new Types.ObjectId());
    state.types[0].amenities = [String(id), other];
    state.partial = true;
    const dto = { description: 'Saved first', roomTypeIds: [String(b)] };
    await expect(service.update(String(id), dto)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(state.amenity?.description).toBe('Saved first');
    await service.update(String(id), dto);
    await service.update(String(id), dto);
    expect(state.types.map((type) => type.amenities)).toEqual([
      [other],
      [String(id)],
      [],
    ]);
  });
  it('detects active target changed during bulk write and never reports success', async () => {
    const { service, roomTypes } = setup();
    roomTypes.bulkWrite.mockResolvedValueOnce({ matchedCount: 0 });
    await expect(
      service.update(String(id), { roomTypeIds: [String(a)] }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
  it('rejects empty, invalid and missing ids before writes', async () => {
    const { service, state, amenities } = setup();
    await expect(service.update(String(id), {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.detail('bad')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    state.amenity = null;
    await expect(
      service.update(String(id), { name: 'X' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.detail(String(id))).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(amenities.findOneAndUpdate).not.toHaveBeenCalled();
  });
});
