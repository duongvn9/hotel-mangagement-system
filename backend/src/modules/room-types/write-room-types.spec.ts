import { ValidationPipe } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Model, Types } from 'mongoose';
import {
  CreateRoomTypeDto,
  UpdateRoomTypeDto,
} from './dto/write-room-type.dto.js';
import { RoomTypesService } from './room-types.service.js';
import { RoomType } from './schemas/room-type.schema.js';
import { AmenitiesService } from '../amenities/amenities.service.js';

const valid = { name: ' Standard ', capacity: 2, basePrice: 850000 };
describe('UC50 write DTO', () => {
  it('trims strings and accepts a valid create', async () => {
    const dto = plainToInstance(CreateRoomTypeDto, valid);
    expect(await validate(dto)).toEqual([]);
    expect(dto.name).toBe('Standard');
  });
  it.each([
    { name: undefined },
    { name: '  ' },
    { name: null },
    { name: 'a'.repeat(101) },
    { capacity: undefined },
    { capacity: 0 },
    { capacity: -1 },
    { capacity: 1.5 },
    { capacity: '2' },
    { basePrice: undefined },
    { basePrice: 0 },
    { basePrice: -1 },
    { basePrice: 1.5 },
    { basePrice: '1' },
    { basePrice: Number.MAX_SAFE_INTEGER + 1 },
    { amenities: null },
    { amenities: ['bad'] },
    { amenities: ['ABCDEF0123456789ABCDEF01'] },
    { amenities: ['abcdef0123456789abcdef01', 'abcdef0123456789abcdef01'] },
    { isActive: null },
    { isActive: 'false' },
    { description: null },
  ])('rejects %j', async (change) => {
    expect(
      (
        await validate(
          plainToInstance(CreateRoomTypeDto, { ...valid, ...change }),
        )
      ).length,
    ).toBeGreaterThan(0);
  });
  it('allows partial patch but rejects null and unknown/immutable fields', async () => {
    expect(
      await validate(plainToInstance(UpdateRoomTypeDto, { isActive: false })),
    ).toEqual([]);
    expect(
      (await validate(plainToInstance(UpdateRoomTypeDto, { capacity: null })))
        .length,
    ).toBeGreaterThan(0);
    const pipe = new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    for (const field of ['_id', 'createdAt', 'updatedAt', 'unknown'])
      await expect(
        pipe.transform(
          { [field]: 'x' },
          { type: 'body', metatype: UpdateRoomTypeDto },
        ),
      ).rejects.toThrow();
  });
});

describe('UC50 service rules', () => {
  const id = String(new Types.ObjectId());
  function setup(
    current = {
      _id: new Types.ObjectId(id),
      name: 'Standard',
      capacity: 2,
      basePrice: 850000,
      isActive: true,
      amenities: [] as Types.ObjectId[],
    },
  ) {
    const result = { ...current, amenities: [] };
    const chain = (value: unknown) => {
      const query = {
        lean: vi.fn(),
        populate: vi.fn(),
        exec: vi.fn().mockResolvedValue(value),
      };
      query.lean.mockReturnValue(query);
      query.populate.mockReturnValue(query);
      return query;
    };
    const write = chain(result);
    const model = {
      exists: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue(current),
      findById: vi.fn().mockReturnValue(chain(current)),
      findOneAndUpdate: vi.fn().mockReturnValue(write),
    };
    const amenities = { validateNew: vi.fn().mockResolvedValue(undefined) };
    return {
      service: new RoomTypesService(
        model as unknown as Model<RoomType>,
        amenities as unknown as AmenitiesService,
      ),
      model,
      amenities,
      write,
    };
  }
  it('validates references before create and populates the result', async () => {
    const { service, model, amenities } = setup();
    await service.create({ ...valid, name: 'Standard' });
    expect(amenities.validateNew).toHaveBeenCalledWith([]);
    expect(model.create).toHaveBeenCalledWith(
      expect.objectContaining({ amenities: [], isActive: true }),
    );
  });
  it('catches both preflight duplicate and E11000 race', async () => {
    const { service, model } = setup();
    model.exists.mockResolvedValueOnce({ _id: id } as never);
    await expect(service.create(valid)).rejects.toMatchObject({ status: 409 });
    expect(model.create).not.toHaveBeenCalled();
    model.create.mockRejectedValueOnce({ code: 11000 });
    await expect(service.create(valid)).rejects.toMatchObject({ status: 409 });
  });
  it('does not write when amenity validation fails', async () => {
    const { service, model, amenities } = setup();
    amenities.validateNew.mockRejectedValueOnce(new Error('invalid amenities'));
    await expect(service.create(valid)).rejects.toThrow('invalid amenities');
    expect(model.create).not.toHaveBeenCalled();
  });
  it('patches only supplied fields atomically with validators and allows repeated deactivate', async () => {
    const { service, model } = setup();
    await service.update(id, { isActive: false });
    await service.update(id, { isActive: false });
    expect(model.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ _id: id }),
      { $set: { isActive: false } },
      { new: true, runValidators: true },
    );
  });
  it('validates retained references using current IDs', async () => {
    const old = new Types.ObjectId();
    const { service, amenities } = setup({
      _id: new Types.ObjectId(id),
      name: 'X',
      capacity: 2,
      basePrice: 1,
      isActive: true,
      amenities: [old],
    });
    await service.update(id, { amenities: [String(old)] });
    expect(amenities.validateNew).toHaveBeenCalledWith(
      [String(old)],
      [String(old)],
    );
  });
  it('blocks activation of invalid legacy data but allows deactivation', async () => {
    const { service, model } = setup({
      _id: new Types.ObjectId(id),
      name: 'X',
      capacity: 0,
      basePrice: 0,
      isActive: false,
      amenities: [],
    });
    await expect(service.update(id, { isActive: true })).rejects.toMatchObject({
      status: 400,
    });
    expect(model.findOneAndUpdate).not.toHaveBeenCalled();
    await service.update(id, { isActive: false });
  });
  it('rejects empty patches and malformed or missing IDs', async () => {
    const { service, model } = setup();
    await expect(service.update(id, {})).rejects.toMatchObject({ status: 400 });
    await expect(service.detail('invalid')).rejects.toMatchObject({
      status: 400,
    });
    model.findById.mockReturnValueOnce({
      lean: () => ({ exec: async () => null }),
    } as never);
    await expect(service.update(id, { isActive: false })).rejects.toMatchObject(
      { status: 404 },
    );
  });
  it('retries a changed snapshot and catches update duplicate race', async () => {
    const { service, write, model } = setup();
    write.exec.mockResolvedValueOnce(null);
    await service.update(id, { capacity: 3 });
    expect(model.findOneAndUpdate).toHaveBeenCalledTimes(2);
    write.exec.mockRejectedValueOnce({ code: 11000 });
    await expect(service.update(id, { name: 'Other' })).rejects.toMatchObject({
      status: 409,
    });
  });
});
