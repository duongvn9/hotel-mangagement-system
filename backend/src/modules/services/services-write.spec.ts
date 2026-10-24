import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Model, Types } from 'mongoose';
import { Service } from './schemas/service.schema.js';
import { ServicesService } from './services.service.js';
import { CreateServiceDto, UpdateServiceDto } from './dto/write-service.dto.js';
const id = String(new Types.ObjectId());
function query(read: () => unknown) {
  const result = { lean: vi.fn(), exec: vi.fn(async () => read()) };
  result.lean.mockReturnValue(result);
  return result;
}
function setup() {
  type Row = Service & { _id: Types.ObjectId; __v?: number };
  const state = {
    row: {
      _id: new Types.ObjectId(id),
      name: 'Laundry',
      description: 'Old',
      unit: 'lần',
      billable: true,
      price: 50000,
      isActive: true,
      __v: 0,
    } as Row | null,
  };
  const model = {
    exists: vi.fn(async () => null as unknown),
    findById: vi.fn(() => query(() => state.row && { ...state.row })),
    findOne: vi.fn(() =>
      query(() => (state.row?.isActive ? { ...state.row } : null)),
    ),
    create: vi.fn(async (fields: Service) => {
      state.row = { _id: new Types.ObjectId(id), __v: 0, ...fields };
      return state.row;
    }),
    findOneAndUpdate: vi.fn(
      (
        filter: { __v: number | { $exists: boolean } },
        update: { $set: Partial<Service>; $inc: { __v: number } },
      ) =>
        query(() => {
          if (
            !state.row ||
            (state.row.__v === undefined
              ? typeof filter.__v !== 'object'
              : state.row.__v !== filter.__v)
          )
            return null;
          Object.assign(state.row, update.$set);
          state.row.__v = (state.row.__v ?? 0) + update.$inc.__v;
          return { ...state.row };
        }),
    ),
  };
  return {
    state,
    model,
    service: new ServicesService(model as unknown as Model<Service>),
  };
}
describe('UC54 DTOs', () => {
  it('trims text and accepts null price on partial updates without adding defaults', async () => {
    const dto = plainToInstance(CreateServiceDto, {
      name: '  New  ',
      description: ' text ',
      unit: ' lần ',
      price: 0,
    });
    expect(await validate(dto)).toEqual([]);
    expect(dto).toMatchObject({
      name: 'New',
      description: 'text',
      unit: 'lần',
      price: 0,
    });
    const patch = plainToInstance(UpdateServiceDto, { price: null });
    expect(await validate(patch)).toEqual([]);
    expect(patch.billable).toBeUndefined();
    expect(patch.isActive).toBeUndefined();
  });
  it.each([
    {},
    { name: '' },
    { name: ' ' },
    { name: 1 },
    { name: 'x'.repeat(101) },
    { name: 'X', description: null },
    { name: 'X', unit: 1 },
    { name: 'X', billable: 'false' },
    { name: 'X', isActive: null },
    { name: 'X', price: -1 },
    { name: 'X', price: 1.5 },
    { name: 'X', price: '100' },
    { name: 'X', price: Number.MAX_SAFE_INTEGER + 1 },
    { name: 'X', _id: id },
    { name: 'X', updatedAt: 'now' },
    { name: 'X', __v: 1 },
  ])('rejects invalid create %j', async (input) => {
    expect(
      (
        await validate(plainToInstance(CreateServiceDto, input), {
          whitelist: true,
          forbidNonWhitelisted: true,
        })
      ).length,
    ).toBeGreaterThan(0);
  });
  it.each(['name', 'description', 'unit', 'billable', 'isActive'])(
    'rejects null PATCH %s',
    async (field) => {
      expect(
        (await validate(plainToInstance(UpdateServiceDto, { [field]: null })))
          .length,
      ).toBeGreaterThan(0);
    },
  );
  it('rejects unknown PATCH fields including timestamps and version', async () => {
    for (const field of ['unknown', '_id', 'createdAt', 'updatedAt', '__v'])
      expect(
        (
          await validate(
            plainToInstance(UpdateServiceDto, { [field]: 'value' }),
            { whitelist: true, forbidNonWhitelisted: true },
          )
        ).length,
      ).toBeGreaterThan(0);
  });
});
describe('UC54 ServicesService', () => {
  it.each([
    { name: 'Paid', price: 100 },
    { name: 'Zero', price: 0 },
    { name: 'Free', billable: false },
    { name: 'Draft', isActive: false },
  ])('creates valid %j and default fields', async (dto) => {
    const { service, model } = setup();
    const row = await service.create(dto);
    expect(row).toMatchObject({
      id,
      name: dto.name,
      description: '',
      unit: '',
    });
    expect(row.price).toBe(dto.price ?? null);
    expect(model.create).toHaveBeenCalledOnce();
  });
  it.each([
    { name: 'Missing' },
    { name: 'Null', price: null },
    { name: 'Negative', price: -1 },
    { name: 'Fraction', price: 1.5 },
    { name: 'Unsafe', price: Number.MAX_SAFE_INTEGER + 1 },
  ])('rejects invalid price state %j without writing', async (dto) => {
    const { service, model } = setup();
    await expect(service.create(dto)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(model.create).not.toHaveBeenCalled();
    expect(model.findOneAndUpdate).not.toHaveBeenCalled();
  });
  it('rejects runtime string prices at the service layer too', async () => {
    const { service, model } = setup();
    await expect(
      service.create({
        name: 'String',
        price: '100',
      } as unknown as CreateServiceDto),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(model.create).not.toHaveBeenCalled();
  });
  it.each([
    {
      current: { billable: true, isActive: false, price: null },
      patch: { isActive: true },
    },
    {
      current: { billable: false, isActive: true, price: null },
      patch: { billable: true },
    },
    {
      current: { billable: true, isActive: true, price: 50000 },
      patch: { price: null },
    },
    {
      current: { billable: false, isActive: false, price: null },
      patch: { price: -1 },
    },
  ])(
    'validates the merged state %j before writing any field',
    async ({ current, patch }) => {
      const { service, state, model } = setup();
      Object.assign(state.row!, current);
      const before = { ...state.row };
      await expect(
        service.update(id, { ...patch, description: 'Do not save' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(model.findOneAndUpdate).not.toHaveBeenCalled();
      expect(state.row).toEqual(before);
    },
  );
  it.each([
    { billable: true, isActive: false, price: null },
    { billable: false, isActive: true, price: null },
    { billable: true, isActive: true, price: 0 },
  ])('accepts valid merged PATCH %j', async (patch) => {
    const { service } = setup();
    expect(await service.update(id, patch)).toMatchObject(patch);
  });
  it('writes supplied fields only and does not change price when toggling billable', async () => {
    const { service, state, model } = setup();
    await service.update(id, { description: 'New' });
    expect(model.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: id, __v: 0 },
      { $set: { description: 'New' }, $inc: { __v: 1 } },
      { returnDocument: 'after', runValidators: true },
    );
    expect(state.row).toMatchObject({
      price: 50000,
      unit: 'lần',
      billable: true,
      __v: 1,
    });
    await service.update(id, { billable: false });
    expect(state.row?.price).toBe(50000);
  });
  it('deactivates idempotently without touching price, billable or record identity', async () => {
    const { service, state } = setup();
    const first = await service.update(id, { isActive: false });
    const second = await service.update(id, { isActive: false });
    expect(second).toEqual(first);
    expect(state.row).toMatchObject({
      _id: new Types.ObjectId(id),
      price: 50000,
      billable: true,
      isActive: false,
      __v: 2,
    });
  });
  it('checks exact unique names and handles duplicate-key races before changing data', async () => {
    const { service, model } = setup();
    model.exists.mockResolvedValueOnce({ _id: new Types.ObjectId() });
    await expect(
      service.create({ name: 'Existing', price: 0 }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(model.create).not.toHaveBeenCalled();
    model.create.mockRejectedValueOnce({ code: 11000 });
    await expect(
      service.create({ name: 'Race', price: 0 }),
    ).rejects.toBeInstanceOf(ConflictException);
    model.findOneAndUpdate.mockReturnValueOnce(
      query(() => {
        throw { code: 11000 };
      }),
    );
    await expect(service.update(id, { name: 'Race' })).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(model.exists).toHaveBeenLastCalledWith({
      name: 'Race',
      _id: { $ne: id },
    });
  });
  it('returns 409 for a version conflict without a blind retry or write', async () => {
    const { service, state, model } = setup();
    const before = { ...state.row };
    model.findOneAndUpdate.mockReturnValueOnce(query(() => null));
    await expect(service.update(id, { price: 0 })).rejects.toThrow(
      'Dữ liệu đã thay đổi, hãy tải lại',
    );
    expect(model.findOneAndUpdate).toHaveBeenCalledOnce();
    expect(state.row).toEqual(before);
  });
  it('guards a legacy missing version and increments it on the first write', async () => {
    const { service, state, model } = setup();
    delete state.row!.__v;
    await service.update(id, { description: 'First' });
    expect(model.findOneAndUpdate.mock.calls[0][0]).toEqual({
      _id: id,
      __v: { $exists: false },
    });
    expect(state.row?.__v).toBe(1);
  });
  it('maps a Mongo price guard failure to a field error instead of reporting success', async () => {
    const { service, model } = setup();
    model.findOneAndUpdate.mockReturnValueOnce(
      query(() => {
        throw { code: 121 };
      }),
    );
    await expect(service.update(id, { price: 0 })).rejects.toThrow(
      'price: cần giá hợp lệ',
    );
  });
  it('rejects invalid/missing ids and empty PATCH', async () => {
    const { service, state, model } = setup();
    await expect(service.detail('bad')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.update(id, {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
    state.row = null;
    await expect(service.detail(id)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.update(id, { name: 'X' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(model.findOneAndUpdate).not.toHaveBeenCalled();
  });
  it('findActiveById is read only and returns null for inactive, missing or invalid IDs', async () => {
    const { service, state, model } = setup();
    expect(await service.findActiveById('bad')).toBeNull();
    expect(model.findOne).not.toHaveBeenCalled();
    expect(await service.findActiveById(id)).toMatchObject({
      id,
      isActive: true,
      price: 50000,
    });
    expect(model.findOne).toHaveBeenCalledWith({ _id: id, isActive: true });
    state.row!.isActive = false;
    expect(await service.findActiveById(id)).toBeNull();
    state.row = null;
    expect(await service.findActiveById(id)).toBeNull();
    expect(model.create).not.toHaveBeenCalled();
    expect(model.findOneAndUpdate).not.toHaveBeenCalled();
  });
});
