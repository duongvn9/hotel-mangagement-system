import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Model, Types } from 'mongoose';
import { BedTypesService } from './bed-types.service.js';
import { BedType } from './schemas/bed-type.schema.js';
import { RoomType } from '../room-types/schemas/room-type.schema.js';
import {
  CreateBedTypeDto,
  UpdateBedTypeDto,
} from './dto/write-bed-type.dto.js';

const id = new Types.ObjectId();
const a = new Types.ObjectId();
const b = new Types.ObjectId();

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
    bedType: {
      _id: id,
      name: 'Giường đôi',
      description: 'Old',
      isActive: true,
    } as Record<string, unknown> | null,
    active: new Set<string>([String(a)]),
  };
  const bedTypes = {
    exists: vi.fn(async () => null as unknown),
    findById: vi.fn(() => query(() => state.bedType && { ...state.bedType })),
    create: vi.fn(async (fields: Record<string, unknown>) => {
      state.bedType = { _id: id, ...fields };
      return state.bedType;
    }),
    findOneAndUpdate: vi.fn(
      (_filter: unknown, update: { $set: Record<string, unknown> }) =>
        query(() => {
          Object.assign(state.bedType!, update.$set);
          return state.bedType;
        }),
    ),
    find: vi.fn((filter: { _id: { $in: string[] } }) =>
      query(() =>
        filter._id.$in
          .filter((value) => state.active.has(value))
          .map((value) => ({ _id: value })),
      ),
    ),
  };
  const roomTypes = { find: vi.fn(() => query(() => [])) };
  return {
    state,
    bedTypes,
    roomTypes,
    service: new BedTypesService(
      bedTypes as unknown as Model<BedType>,
      roomTypes as unknown as Model<RoomType>,
    ),
  };
}

describe('bed type write DTOs', () => {
  it('trims fields, accepts defaults and a partial PATCH', async () => {
    const dto = plainToInstance(CreateBedTypeDto, {
      name: '  Giường đôi  ',
      description: ' note ',
    });
    expect(await validate(dto)).toEqual([]);
    expect(dto).toMatchObject({ name: 'Giường đôi', description: 'note' });
    expect(
      await validate(plainToInstance(UpdateBedTypeDto, { description: '  ' })),
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
    { name: 'ok', _id: String(id) },
    { name: 'ok', createdAt: 'now' },
  ])('rejects invalid create %j', async (input) => {
    expect(
      (
        await validate(plainToInstance(CreateBedTypeDto, input), {
          whitelist: true,
          forbidNonWhitelisted: true,
        })
      ).length,
    ).toBeGreaterThan(0);
  });

  it.each(['name', 'description', 'isActive'])(
    'rejects null PATCH %s',
    async (field) => {
      expect(
        (await validate(plainToInstance(UpdateBedTypeDto, { [field]: null })))
          .length,
      ).toBeGreaterThan(0);
    },
  );
});

describe('bed type write service', () => {
  it('creates with public response and defaults', async () => {
    const { service, bedTypes } = setup();
    const result = await service.create({ name: 'Giường King' });
    expect(result).toMatchObject({
      id: String(id),
      name: 'Giường King',
      description: '',
      isActive: true,
      roomTypes: [],
      roomTypeCount: 0,
    });
    expect(bedTypes.create).toHaveBeenCalledWith({
      name: 'Giường King',
      description: '',
      isActive: true,
    });
  });

  it('handles name precheck and unique-index races', async () => {
    const { service, bedTypes } = setup();
    bedTypes.exists.mockResolvedValueOnce({ _id: id });
    await expect(service.create({ name: 'Giường đôi' })).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(bedTypes.create).not.toHaveBeenCalled();
    bedTypes.create.mockRejectedValueOnce({ code: 11000 });
    await expect(service.create({ name: 'Race' })).rejects.toBeInstanceOf(
      ConflictException,
    );
    bedTypes.findOneAndUpdate.mockReturnValueOnce(
      query(() => {
        throw { code: 11000 };
      }),
    );
    await expect(
      service.update(String(id), { name: 'Race' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('preserves omitted fields, uses exact name and self exclusion', async () => {
    const { service, bedTypes, state } = setup();
    await service.update(String(id), { name: 'Giường đơn' });
    expect(bedTypes.exists).toHaveBeenCalledWith({
      name: 'Giường đơn',
      _id: { $ne: String(id) },
    });
    expect(bedTypes.findOneAndUpdate.mock.calls[0][1]).toEqual({
      $set: { name: 'Giường đơn' },
    });
    expect(state.bedType?.description).toBe('Old');
  });

  it('rejects empty, invalid and missing ids before writes', async () => {
    const { service, state, bedTypes } = setup();
    await expect(service.update(String(id), {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.update('bad', { name: 'X' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.detail('bad')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    state.bedType = null;
    await expect(
      service.update(String(id), { name: 'X' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.detail(String(id))).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(bedTypes.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('validateNew accepts active ids, skips retained, rejects inactive or missing', async () => {
    const { service } = setup();
    await expect(service.validateNew([String(a)])).resolves.toBeUndefined();
    await expect(
      service.validateNew([String(a), String(b)], [String(b)]),
    ).resolves.toBeUndefined();
    await expect(service.validateNew([String(b)])).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
