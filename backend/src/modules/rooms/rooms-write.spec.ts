import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Model, Types } from 'mongoose';
import { RoomsService } from './rooms.service.js';
import { Room } from './schemas/room.schema.js';
import { RoomType } from '../room-types/schemas/room-type.schema.js';
import { CreateRoomDto, UpdateRoomDto } from './dto/write-room.dto.js';
import { RoomStatus } from '../../common/constants/room-status.enum.js';

const id = String(new Types.ObjectId());
const typeId = String(new Types.ObjectId());
const nextType = String(new Types.ObjectId());
const input = { roomNumber: '101', floor: 1, roomType: typeId };
function query(raw: unknown, populated = raw) {
  const exec = vi.fn().mockResolvedValue(raw);
  const populatedExec = vi.fn().mockResolvedValue(populated);
  const chain = {
    lean: () => ({ exec }),
    populate: vi.fn(() => ({ lean: () => ({ exec: populatedExec }) })),
  };
  return { ...chain, exec, populatedExec };
}
function setup(change: Partial<Room> = {}) {
  const current = {
    _id: new Types.ObjectId(id),
    ...input,
    roomType: new Types.ObjectId(typeId),
    status: RoomStatus.Available,
    notes: 'Keep',
    isActive: true,
    ...change,
  };
  const populated = {
    ...current,
    roomType: {
      _id: new Types.ObjectId(typeId),
      name: 'Standard',
      isActive: true,
    },
  };
  const read = query(current, populated);
  const write = query(populated);
  const rooms = {
    exists: vi.fn().mockResolvedValue(null),
    findById: vi.fn().mockReturnValue(read),
    create: vi.fn().mockResolvedValue({ _id: id }),
    findOneAndUpdate: vi.fn().mockReturnValue(write),
  };
  const types = { exists: vi.fn().mockResolvedValue({ _id: typeId }) };
  return {
    service: new RoomsService(
      rooms as unknown as Model<Room>,
      types as unknown as Model<RoomType>,
    ),
    rooms,
    types,
    current,
    read,
    write,
  };
}

describe('UC48 write DTO', () => {
  it('trims roomNumber/notes and accepts negative or ground floor', async () => {
    const dto = plainToInstance(CreateRoomDto, {
      ...input,
      roomNumber: ' 101 ',
      floor: -1,
      notes: ' note ',
    });
    expect(await validate(dto)).toEqual([]);
    expect(dto).toMatchObject({ roomNumber: '101', notes: 'note', floor: -1 });
    expect(
      await validate(plainToInstance(CreateRoomDto, { ...input, floor: 0 })),
    ).toEqual([]);
  });
  it.each([
    { roomNumber: undefined },
    { roomNumber: '' },
    { roomNumber: ' ' },
    { roomNumber: 101 },
    { floor: undefined },
    { floor: 1.5 },
    { floor: '1' },
    { floor: Number.MAX_SAFE_INTEGER + 1 },
    { roomType: undefined },
    { roomType: null },
    { roomType: [] },
    { roomType: 'bad' },
    { roomType: 'ABCDEFABCDEFABCDEFABCDEF' },
    { status: 'RESERVED' },
    { status: null },
    { notes: null },
    { notes: [] },
    { isActive: 'false' },
    { isActive: null },
  ])('rejects invalid create %j', async (change) => {
    expect(
      (await validate(plainToInstance(CreateRoomDto, { ...input, ...change })))
        .length,
    ).toBeGreaterThan(0);
  });
  it.each([
    { roomNumber: null },
    { floor: null },
    { roomType: null },
    { status: null },
    { isActive: null },
    { notes: null },
    { _id: id },
    { updatedAt: 'now' },
    { unknown: 1 },
  ])('rejects null or unknown update %j', async (change) => {
    expect(
      (
        await validate(plainToInstance(UpdateRoomDto, change), {
          whitelist: true,
          forbidNonWhitelisted: true,
        })
      ).length,
    ).toBeGreaterThan(0);
  });
  it('allows individual fields and all four statuses', async () => {
    for (const status of Object.values(RoomStatus))
      expect(
        await validate(plainToInstance(UpdateRoomDto, { status })),
      ).toEqual([]);
    expect(
      await validate(plainToInstance(UpdateRoomDto, { isActive: false })),
    ).toEqual([]);
  });
});

describe('UC48 RoomsService', () => {
  it('creates a valid room and returns the same public item contract as list', async () => {
    const { service, rooms } = setup();
    expect(await service.create(input)).toMatchObject({
      id,
      roomNumber: '101',
      status: 'AVAILABLE',
      roomType: { id: typeId },
    });
    expect(rooms.create).toHaveBeenCalledWith(input);
  });
  it('rejects creation if there are no active types', async () => {
    const { service, rooms, types } = setup();
    types.exists.mockResolvedValue(null);
    await expect(service.create(input)).rejects.toThrow(
      'Chưa có loại phòng hoạt động',
    );
    expect(rooms.create).not.toHaveBeenCalled();
  });
  it.each(['missing', 'inactive', 'bad'])(
    'rejects %s type before persisting',
    async (kind) => {
      const { service, types, rooms } = setup();
      types.exists.mockResolvedValueOnce({ _id: id }).mockResolvedValue(null);
      await expect(
        service.create({ ...input, roomType: kind === 'bad' ? 'bad' : typeId }),
      ).rejects.toThrow('Loại phòng');
      expect(rooms.create).not.toHaveBeenCalled();
    },
  );
  it('checks exact roomNumber uniqueness and excludes self on rename', async () => {
    const { service, rooms } = setup();
    rooms.exists.mockResolvedValue({ _id: id });
    await expect(service.create(input)).rejects.toMatchObject({ status: 409 });
    expect(rooms.exists).toHaveBeenCalledWith({ roomNumber: '101' });
    await expect(
      service.update(id, { roomNumber: '102' }),
    ).rejects.toMatchObject({ status: 409 });
    expect(rooms.exists).toHaveBeenLastCalledWith({
      roomNumber: '102',
      _id: { $ne: id },
    });
    expect(rooms.findOneAndUpdate).not.toHaveBeenCalled();
  });
  it('converts create duplicate index race to 409 and propagates other DB errors', async () => {
    const { service, rooms } = setup();
    rooms.create.mockRejectedValue({ code: 11000 });
    await expect(service.create(input)).rejects.toMatchObject({ status: 409 });
    rooms.create.mockRejectedValue(new Error('database offline'));
    await expect(service.create(input)).rejects.toThrow('database offline');
  });
  it('converts update duplicate index race to 409', async () => {
    const { service, write } = setup();
    write.populatedExec.mockRejectedValue({ code: 11000 });
    await expect(
      service.update(id, { roomNumber: '102' }),
    ).rejects.toMatchObject({ status: 409 });
  });
  it('writes only sent fields atomically with validators and returns the result', async () => {
    const { service, rooms, current } = setup();
    const result = await service.update(id, { notes: 'New' });
    expect(rooms.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: id, roomType: current.roomType, isActive: true },
      { $set: { notes: 'New' } },
      { returnDocument: 'after', runValidators: true },
    );
    expect(result).toMatchObject({ roomNumber: '101', floor: 1 });
  });
  it('validates a newly assigned active type', async () => {
    const { service, types } = setup();
    await service.update(id, { roomType: nextType });
    expect(types.exists).toHaveBeenCalledWith({
      _id: nextType,
      isActive: true,
    });
  });
  it('rejects changing to inactive type without a write', async () => {
    const { service, types, rooms } = setup();
    types.exists.mockResolvedValue(null);
    await expect(
      service.update(id, { roomType: nextType }),
    ).rejects.toMatchObject({ status: 400 });
    expect(rooms.findOneAndUpdate).not.toHaveBeenCalled();
  });
  it('allows other edits and deactivation when the existing type is inactive', async () => {
    const { service, types, rooms } = setup();
    types.exists.mockResolvedValue(null);
    await service.update(id, {
      notes: 'Still editable',
      status: RoomStatus.Occupied,
    });
    await service.update(id, { isActive: false });
    expect(types.exists).not.toHaveBeenCalled();
    expect(rooms.findOneAndUpdate).toHaveBeenCalledTimes(2);
  });
  it('requires valid type on reactivation, including replacement in the same PATCH', async () => {
    const { service, types, rooms } = setup({ isActive: false });
    types.exists.mockResolvedValue(null);
    await expect(service.update(id, { isActive: true })).rejects.toThrow(
      'Loại phòng',
    );
    expect(rooms.findOneAndUpdate).not.toHaveBeenCalled();
    types.exists.mockResolvedValue({ _id: nextType });
    await service.update(id, { isActive: true, roomType: nextType });
    expect(types.exists).toHaveBeenLastCalledWith({
      _id: nextType,
      isActive: true,
    });
  });
  it('deactivation is idempotent and never deletes the room', async () => {
    const { service, rooms, types } = setup({ isActive: false });
    await service.update(id, { isActive: false });
    expect(rooms.findOneAndUpdate.mock.calls[0][1]).toEqual({
      $set: { isActive: false },
    });
    expect(types.exists).not.toHaveBeenCalled();
    expect(service).not.toHaveProperty('delete');
  });
  it('rejects empty body, invalid ids and missing rooms', async () => {
    const { service, read } = setup();
    await expect(service.update(id, {})).rejects.toMatchObject({ status: 400 });
    await expect(service.update('bad', { notes: 'x' })).rejects.toMatchObject({
      status: 400,
    });
    await expect(service.detail('bad')).rejects.toMatchObject({ status: 400 });
    read.exec.mockResolvedValue(null);
    read.populatedExec.mockResolvedValue(null);
    await expect(service.detail(id)).rejects.toMatchObject({ status: 404 });
    await expect(service.update(id, { notes: 'x' })).rejects.toMatchObject({
      status: 404,
    });
  });
  it('retries a changed Room snapshot and fails clearly on persistent contention', async () => {
    const { service, rooms, write } = setup();
    write.populatedExec.mockResolvedValueOnce(null);
    await service.update(id, { isActive: false });
    expect(rooms.findById).toHaveBeenCalledTimes(2);
    write.populatedExec.mockResolvedValue(null);
    await expect(service.update(id, { isActive: false })).rejects.toMatchObject(
      { status: 409 },
    );
  });
});
