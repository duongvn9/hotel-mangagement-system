import { BadRequestException } from '@nestjs/common';
import { Types, type Connection, type Model } from 'mongoose';
import type { Role } from '../roles/schemas/role.schema.js';
import type { User } from '../users/schemas/user.schema.js';
import type { Task } from './schemas/task.schema.js';
import { TaskSourceType } from './task-contract.js';
import { TASK_SOURCE_COLLECTIONS, TasksService } from './tasks.service.js';

const ID = '6718a1b2c3d4e5f601234567';
const input = {
  title: 'Kiểm tra phòng khi trả phòng GE-1',
  taskType: 'CHECKOUT_INSPECTION',
  priority: 'HIGH',
  assigneeId: ID,
  sourceId: ID,
  sourceType: TaskSourceType.CheckoutInspection,
};

function setup(role = 'SERVICE_STAFF', latest: object | null = null) {
  const tasks = {
    create: vi.fn(async (doc: object) => ({ _id: ID, ...doc })),
    collection: { createIndex: vi.fn(async () => 'unique_active_task_work') },
    findOne: vi.fn(() => ({
      sort: () => ({ lean: async () => latest }),
    })),
  };
  const users = {
    findById: vi.fn(() => ({ lean: async () => ({ role, isActive: true }) })),
  };
  const findOne = vi.fn(async () => ({ _id: ID }));
  const connection = { collection: vi.fn(() => ({ findOne })) };
  const service = new TasksService(
    tasks as unknown as Model<Task>,
    users as unknown as Model<User>,
    { exists: vi.fn() } as unknown as Model<Role>,
    connection as unknown as Connection,
  );
  return { service, tasks, connection };
}

describe('checkout inspection tasks', () => {
  it('reads the booking as the task source', async () => {
    const { service, connection, tasks } = setup();

    await service.create(input);

    expect(connection.collection).toHaveBeenCalledWith('bookings');
    expect(TASK_SOURCE_COLLECTIONS[TaskSourceType.CheckoutInspection]).toBe(
      'bookings',
    );
    expect(tasks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceType: 'CHECKOUT_INSPECTION',
        taskType: 'CHECKOUT_INSPECTION',
        status: 'ASSIGNED',
      }),
    );
  });

  it.each(['OPERATIONS_STAFF', 'RECEPTIONIST', 'CUSTOMER'])(
    'refuses an assignee who is %s',
    async (role) => {
      const { service, tasks } = setup(role);

      await expect(service.create(input)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(tasks.create).not.toHaveBeenCalled();
    },
  );

  it('finds the newest task of a source', async () => {
    const newest = { _id: ID, status: 'COMPLETED', workResult: 'Giặt ủi 2kg' };
    const { service, tasks } = setup('SERVICE_STAFF', newest);

    const found = await service.latestForSource(
      TaskSourceType.CheckoutInspection,
      ID,
    );

    expect(found).toBe(newest);
    expect(tasks.findOne).toHaveBeenCalledWith({
      sourceType: TaskSourceType.CheckoutInspection,
      sourceId: new Types.ObjectId(ID),
    });
  });
});
