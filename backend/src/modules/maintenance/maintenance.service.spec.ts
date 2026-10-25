import { NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { randomUUID } from 'node:crypto';
import { MaintenanceService } from './maintenance.service.js';
import { RoomStatus } from '../../common/constants/room-status.enum.js';
import { Role } from '../../common/constants/role.enum.js';

const actor = {
  id: String(new Types.ObjectId()),
  role: Role.OperationsStaff,
  email: 'ops@example.test',
};
const roomId = String(new Types.ObjectId());
const deviceId = String(new Types.ObjectId());
const dto = {
  roomId,
  description: 'Điều hòa bị rò điện',
  requiresAction: true,
  preventsSafeUse: true,
};
const query = (value: unknown) => ({
  lean: () => query(value),
  exec: async () => value,
});
describe('UC35 validation, standalone writes and recovery', () => {
  let service: MaintenanceService;
  let saved: any;
  let task: any;
  let room: any;
  let equipment: any;
  let rooms: any;
  let reports: any;
  let tasks: any;
  let users: any;
  let key: string;
  beforeEach(() => {
    saved = undefined;
    task = undefined;
    key = randomUUID();
    room = {
      _id: new Types.ObjectId(roomId),
      isActive: true,
      status: RoomStatus.Available,
    };
    reports = {
      findOne: vi.fn(() => query(saved)),
      collection: { createIndex: vi.fn().mockResolvedValue('index') },
      findOneAndUpdate: vi.fn((_filter, update) => {
        saved ??= { _id: new Types.ObjectId(), ...update.$setOnInsert };
        return query(saved);
      }),
      updateOne: vi.fn(async (_filter, update) => {
        Object.assign(saved, update.$set);
        return { matchedCount: 1 };
      }),
      findById: vi.fn(() => query(saved)),
    };
    rooms = {
      findOne: vi.fn(() => query(room)),
      findOneAndUpdate: vi.fn(() => {
        if (
          room &&
          [RoomStatus.Available, RoomStatus.Cleaning].includes(room.status)
        ) {
          room.status = RoomStatus.Maintenance;
          return query(room);
        }
        return query(null);
      }),
    };
    equipment = {
      findActive: vi.fn().mockResolvedValue({
        _id: new Types.ObjectId(deviceId),
        room: new Types.ObjectId(roomId),
      }),
      markFaulty: vi.fn().mockResolvedValue(undefined),
    };
    users = {
      findOne: vi.fn(() =>
        query({ _id: actor.id, role: Role.OperationsStaff, isActive: true }),
      ),
    };
    tasks = {
      findAssigned: vi.fn(async () => {
        if (!task) throw new NotFoundException();
        return task;
      }),
      create: vi.fn(async (input, identity) => {
        task = { ...input, id: String(identity) };
        return { _id: identity };
      }),
    };
    service = new MaintenanceService(reports, rooms, users, equipment, tasks);
  });
  it.each([
    { roomId },
    { equipmentId: deviceId },
    { facilityLocation: 'Sảnh chính' },
  ])(
    'accepts target %j with direct MAINTENANCE source and stable identity',
    async (target) => {
      const result = await service.report(
        {
          ...dto,
          ...target,
          roomId: undefined,
          ...target,
          preventsSafeUse: false,
        },
        actor,
        key,
      );
      expect(result.reportId).toBe(String(saved._id));
      expect(result.taskId).toBe(task.id);
      expect(tasks.create).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceType: 'MAINTENANCE',
          sourceId: result.reportId,
          taskType: 'MAINTENANCE',
          priority: 'NORMAL',
          assigneeId: actor.id,
        }),
        saved.taskIdentity,
      );
    },
  );
  it.each([
    { roomId: undefined },
    { description: '' },
    { description: ' ' },
    { description: 'x'.repeat(2001) },
    { roomId: 'invalid' },
    { roomId: null },
    { requiresAction: 'true' },
    { preventsSafeUse: true, requiresAction: false },
    { unknown: true },
  ])('rejects invalid input %j without any business writes', async (change) => {
    await expect(
      service.report({ ...dto, ...change } as never, actor, key),
    ).rejects.toMatchObject({ status: 400 });
    expect(reports.findOneAndUpdate).not.toHaveBeenCalled();
    expect(tasks.create).not.toHaveBeenCalled();
    expect(equipment.markFaulty).not.toHaveBeenCalled();
    expect(rooms.findOneAndUpdate).not.toHaveBeenCalled();
  });
  it('rejects missing/inactive equipment, room and inconsistent equipment/room before writing', async () => {
    equipment.findActive.mockResolvedValueOnce(null);
    await expect(
      service.report({ ...dto, equipmentId: deviceId }, actor, key),
    ).rejects.toMatchObject({ status: 400 });
    rooms.findOne.mockReturnValueOnce(query(null));
    await expect(service.report(dto, actor, key)).rejects.toMatchObject({
      status: 400,
    });
    equipment.findActive.mockResolvedValueOnce({ room: new Types.ObjectId() });
    await expect(
      service.report({ ...dto, equipmentId: deviceId }, actor, key),
    ).rejects.toMatchObject({ status: 400 });
    expect(reports.findOneAndUpdate).not.toHaveBeenCalled();
  });
  it('requires a room for unsafe common-facility/equipment reports', async () => {
    equipment.findActive.mockResolvedValue({ _id: deviceId });
    for (const target of [
      { equipmentId: deviceId },
      { facilityLocation: 'Sảnh' },
    ])
      await expect(
        service.report({ ...dto, roomId: undefined, ...target }, actor, key),
      ).rejects.toMatchObject({ status: 400 });
    expect(reports.findOneAndUpdate).not.toHaveBeenCalled();
  });
  it.each([RoomStatus.Available, RoomStatus.Cleaning, RoomStatus.Maintenance])(
    'safely marks or preserves %s and uses URGENT',
    async (status) => {
      room.status = status;
      expect(await service.report(dto, actor, key)).toMatchObject({
        roomMarkedUnavailable: true,
        warnings: [],
      });
      expect(tasks.create.mock.calls[0][0].priority).toBe('URGENT');
      expect(rooms.findOneAndUpdate).toHaveBeenCalledWith(
        {
          _id: roomId,
          isActive: true,
          status: { $in: ['AVAILABLE', 'CLEANING'] },
        },
        { $set: { status: 'MAINTENANCE' } },
        expect.any(Object),
      );
    },
  );
  it('does not overwrite OCCUPIED and returns a warning', async () => {
    room.status = RoomStatus.Occupied;
    expect(await service.report(dto, actor, key)).toMatchObject({
      roomMarkedUnavailable: false,
      warnings: ['Phòng đang có khách; cần lễ tân xử lý'],
    });
    expect(room.status).toBe(RoomStatus.Occupied);
    expect(task).toBeDefined();
  });
  it('requiresAction false creates no task; preventsSafeUse false never updates Room', async () => {
    const result = await service.report(
      {
        ...dto,
        equipmentId: deviceId,
        preventsSafeUse: false,
        requiresAction: false,
      },
      actor,
      key,
    );
    expect(result.taskId).toBeUndefined();
    expect(tasks.create).not.toHaveBeenCalled();
    expect(rooms.findOneAndUpdate).not.toHaveBeenCalled();
    expect(equipment.markFaulty).toHaveBeenCalledWith(deviceId);
  });
  it('reports a partial failure with reportId and retries the same task identity', async () => {
    tasks.create.mockRejectedValueOnce(new Error('Injected task failure'));
    await expect(service.report(dto, actor, key)).rejects.toMatchObject({
      status: 503,
      message: expect.stringContaining('đã được lưu'),
    });
    expect(saved).toBeDefined();
    expect(saved.receipt).toBeUndefined();
    expect(rooms.findOneAndUpdate).not.toHaveBeenCalled();
    const id = String(saved._id);
    const identity = String(saved.taskIdentity);
    expect(await service.report(dto, actor, key)).toMatchObject({
      reportId: id,
      taskId: identity,
    });
    expect(
      tasks.create.mock.calls.map((call: any[]) => String(call[1])),
    ).toEqual([identity, identity]);
  });
  it('reconciles an uncertain create response and does not create another task after effects fail', async () => {
    const create = tasks.create.getMockImplementation();
    tasks.create.mockImplementationOnce(async (...args: any[]) => {
      await create(...args);
      throw new Error('Lost response');
    });
    equipment.markFaulty.mockRejectedValueOnce(
      new Error('Injected effect failure'),
    );
    await expect(
      service.report({ ...dto, equipmentId: deviceId }, actor, key),
    ).rejects.toMatchObject({ status: 503 });
    expect(tasks.create).toHaveBeenCalledTimes(1);
    await service.report({ ...dto, equipmentId: deviceId }, actor, key);
    expect(tasks.create).toHaveBeenCalledTimes(1);
  });
  it('replays a committed receipt without reblocking a room restored later; rejects changed payload', async () => {
    const first = await service.report(dto, actor, key);
    room.status = RoomStatus.Available;
    const calls = rooms.findOneAndUpdate.mock.calls.length;
    expect(await service.report(dto, actor, key)).toEqual(first);
    expect(rooms.findOneAndUpdate).toHaveBeenCalledTimes(calls);
    expect(room.status).toBe(RoomStatus.Available);
    await expect(
      service.report({ ...dto, description: 'Different' }, actor, key),
    ).rejects.toMatchObject({ status: 409 });
  });
  it('recovers after effects succeeded but receipt persistence failed, retaining one Task', async () => {
    const update = reports.updateOne.getMockImplementation();
    reports.updateOne.mockImplementation(async (filter: any, value: any) => {
      if (value.$set.receipt) throw new Error('Injected receipt failure');
      return update(filter, value);
    });
    await expect(service.report(dto, actor, key)).rejects.toMatchObject({
      status: 503,
    });
    expect(room.status).toBe(RoomStatus.Maintenance);
    reports.updateOne.mockImplementation(update);
    expect(await service.report(dto, actor, key)).toMatchObject({
      roomMarkedUnavailable: true,
    });
    expect(tasks.create).toHaveBeenCalledTimes(1);
  });
  it('rejects non-operations/inactive actors and invalid keys before business writes', async () => {
    await expect(
      service.report(dto, { ...actor, role: Role.Manager }, key),
    ).rejects.toMatchObject({ status: 403 });
    await expect(service.report(dto, actor, 'invalid')).rejects.toMatchObject({
      status: 400,
    });
    users.findOne.mockReturnValue(query(null));
    await expect(service.report(dto, actor, key)).rejects.toMatchObject({
      status: 403,
    });
    expect(reports.findOneAndUpdate).not.toHaveBeenCalled();
  });
});
