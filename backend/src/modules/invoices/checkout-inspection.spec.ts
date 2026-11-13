import { ConflictException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { BookingStatus } from '../bookings/schemas/booking.schema.js';
import { RoomStatus } from '../../common/constants/room-status.enum.js';
import { TaskSourceType } from '../tasks/task-contract.js';
import { CheckoutInspectionService } from './checkout-inspection.service.js';

const bookingId = new Types.ObjectId().toHexString();
const staffId = new Types.ObjectId().toHexString();

function setup(
  options: {
    status?: BookingStatus;
    latest?: Record<string, unknown> | null;
    createError?: Error;
  } = {},
) {
  const roomIds = [new Types.ObjectId()];
  const bookings = {
    findById: vi.fn(async () => ({
      _id: bookingId,
      code: 'GE-1',
      status: options.status ?? BookingStatus.CheckedIn,
      isActive: true,
      rooms: roomIds,
    })),
  };
  const staff = [{ _id: staffId, fullName: 'Lê Văn Dịch Vụ' }];
  const users = {
    find: vi.fn(() => ({
      select: () => ({ sort: () => ({ lean: async () => staff }) }),
    })),
    findById: vi.fn(() => ({
      select: () => ({ lean: async () => staff[0] }),
    })),
  };
  const created = {
    _id: new Types.ObjectId(),
    status: 'ASSIGNED',
    assignedTo: staffId,
    assignedAt: new Date('2026-11-10T04:00:00Z'),
  };
  const tasks = {
    create: vi.fn(async () => {
      if (options.createError) throw options.createError;
      return created;
    }),
    latestForSource: vi.fn(async () => options.latest ?? null),
  };
  const rooms = { updateMany: vi.fn(async () => ({ modifiedCount: 1 })) };
  const sut = new CheckoutInspectionService(
    bookings as never,
    users as never,
    rooms as never,
    tasks as never,
  );
  return { sut, tasks, users, rooms, roomIds };
}

describe('CheckoutInspectionService.request', () => {
  it('asks the chosen service staff to inspect the stay', async () => {
    const { sut, tasks, rooms, roomIds } = setup();

    const view = await sut.request(bookingId, { assigneeId: staffId });

    expect(tasks.create).toHaveBeenCalledWith({
      title: 'Kiểm tra phòng khi trả phòng GE-1',
      taskType: 'CHECKOUT_INSPECTION',
      priority: 'HIGH',
      sourceType: TaskSourceType.CheckoutInspection,
      sourceId: bookingId,
      assigneeId: staffId,
      instructions: expect.stringContaining('dịch vụ'),
    });
    expect(rooms.updateMany).toHaveBeenCalledWith(
      { _id: { $in: roomIds }, status: RoomStatus.Occupied },
      { $set: { status: RoomStatus.Cleaning } },
    );
    expect(view).toMatchObject({
      status: 'ASSIGNED',
      assigneeName: 'Lê Văn Dịch Vụ',
      requestedAt: '2026-11-10T04:00:00.000Z',
    });
  });

  it('puts the receptionist note in the instructions', async () => {
    const { sut, tasks } = setup();

    await sut.request(bookingId, {
      assigneeId: staffId,
      note: 'Khách báo vỡ ly',
    });

    expect(tasks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        instructions: expect.stringContaining('Khách báo vỡ ly'),
      }),
    );
  });

  it('refuses a guest who is not checked in and creates nothing', async () => {
    const { sut, tasks } = setup({ status: BookingStatus.Confirmed });

    await expect(
      sut.request(bookingId, { assigneeId: staffId }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tasks.create).not.toHaveBeenCalled();
  });

  it('lets the active-task conflict reach the caller', async () => {
    const { sut, rooms } = setup({
      createError: new ConflictException('An active task already exists'),
    });

    await expect(
      sut.request(bookingId, { assigneeId: staffId }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(rooms.updateMany).not.toHaveBeenCalled();
  });

  it('returns 404 for an unknown booking id format', async () => {
    const { sut } = setup();

    await expect(
      sut.request('not-an-id', { assigneeId: staffId }),
    ).rejects.toThrow();
  });
});

describe('CheckoutInspectionService.current', () => {
  it('returns null when no inspection was requested', async () => {
    const { sut } = setup({ latest: null });

    expect(await sut.current(bookingId)).toEqual({ inspection: null });
  });

  it('returns the staff result once the task is completed', async () => {
    const { sut } = setup({
      latest: {
        _id: new Types.ObjectId(),
        status: 'COMPLETED',
        assignedTo: staffId,
        assignedAt: new Date('2026-11-10T04:00:00Z'),
        completedAt: new Date('2026-11-10T05:00:00Z'),
        workResult: 'Dùng 2 chai nước; vỡ 1 ly',
      },
    });

    const { inspection } = await sut.current(bookingId);

    expect(inspection).toMatchObject({
      status: 'COMPLETED',
      completedAt: '2026-11-10T05:00:00.000Z',
      workResult: 'Dùng 2 chai nước; vỡ 1 ly',
      assigneeName: 'Lê Văn Dịch Vụ',
    });
  });

  it('returns 404 when the booking does not exist', async () => {
    const { sut } = setup();
    (
      sut as unknown as { bookings: { findById: () => unknown } }
    ).bookings.findById = async () => null;

    await expect(sut.current(bookingId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('CheckoutInspectionService.inspectors', () => {
  it('lists only active service staff', async () => {
    const { sut, users } = setup();

    const result = await sut.inspectors();

    expect(users.find).toHaveBeenCalledWith({
      isActive: true,
      role: 'SERVICE_STAFF',
    });
    expect(result).toEqual({
      items: [{ id: staffId, fullName: 'Lê Văn Dịch Vụ' }],
    });
  });
});
