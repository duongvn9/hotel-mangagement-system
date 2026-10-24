import { Types } from 'mongoose';
import type { Model } from 'mongoose';
import { Role } from '../../common/constants/role.enum.js';
import { ServiceTaskIssuesService } from './service-task-issues.service.js';
import { Issue, ISSUE_REQUEST_INDEX } from './schemas/issue.schema.js';
import { Task } from '../tasks/schemas/task.schema.js';
import { ServiceOrder } from '../service-orders/schemas/service-order.schema.js';
import { Service } from '../services/schemas/service.schema.js';
import { Booking } from '../bookings/schemas/booking.schema.js';
import { User } from '../users/schemas/user.schema.js';

describe('ServiceTaskIssuesService authorization and index', () => {
  const staff = new Types.ObjectId();
  const taskId = new Types.ObjectId();
  const sourceId = new Types.ObjectId();
  const findUser = vi.fn();
  const findTask = vi.fn();
  const findOrder = vi.fn();
  const createIndex = vi.fn();
  const chain = (value: unknown) => ({
    select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(value) }),
  });
  const service = new ServiceTaskIssuesService(
    { collection: { createIndex } } as unknown as Model<Issue>,
    { findOne: findTask } as unknown as Model<Task>,
    { findOne: findOrder } as unknown as Model<ServiceOrder>,
    {} as Model<Service>,
    {} as Model<Booking>,
    { findOne: findUser } as unknown as Model<User>,
  );
  const user = {
    id: String(staff),
    email: 'private@example.test',
    role: Role.ServiceStaff,
  };

  beforeEach(() => vi.clearAllMocks());

  it('ensures the partial atomic index even when autoIndex is disabled', async () => {
    await service.onModuleInit();
    expect(createIndex).toHaveBeenCalledWith(
      { reporter: 1, requestId: 1 },
      ISSUE_REQUEST_INDEX,
    );
    expect(ISSUE_REQUEST_INDEX).toMatchObject({
      unique: true,
      partialFilterExpression: { requestId: { $type: 'string' } },
    });
  });

  it('fails initialization instead of silently disabling idempotency', async () => {
    createIndex.mockRejectedValueOnce(new Error('index failed'));
    await expect(service.onModuleInit()).rejects.toThrow('index failed');
  });

  it.each([
    Role.Customer,
    Role.OperationsStaff,
    Role.Manager,
    Role.Receptionist,
    'CUSTOM_SERVICE',
  ])('denies nonexact role %s in both service methods', async (role) => {
    const denied = { ...user, role };
    await expect(service.context(String(taskId), denied)).rejects.toMatchObject(
      { status: 403 },
    );
    await expect(
      service.report(
        String(taskId),
        { title: 'Issue', category: 'Service', description: 'Problem' },
        denied,
      ),
    ).rejects.toMatchObject({ status: 403 });
    expect(findUser).not.toHaveBeenCalled();
    expect(findTask).not.toHaveBeenCalled();
  });

  it('denies malformed current user identity', async () => {
    await expect(
      service.context(String(taskId), { ...user, id: 'bad' }),
    ).rejects.toMatchObject({ status: 401 });
  });

  it('requires authoritative active staff and scopes the persisted task to that sole assignee', async () => {
    findUser.mockReturnValue(chain({ _id: staff }));
    findTask.mockReturnValue(chain(null));
    await expect(service.context(String(taskId), user)).rejects.toMatchObject({
      status: 404,
    });
    expect(findUser).toHaveBeenCalledWith({
      _id: staff,
      role: Role.ServiceStaff,
      isActive: true,
    });
    expect(findTask).toHaveBeenCalledWith({
      _id: taskId,
      assignedTo: staff,
      sourceType: 'SERVICE_ORDER',
      taskType: 'SERVICE_ORDER_EXECUTION',
    });
  });

  it('requires accepted order backlink rather than any task source reference', async () => {
    findUser.mockReturnValue(chain({ _id: staff }));
    findTask.mockReturnValue(chain({ _id: taskId, sourceId }));
    findOrder.mockReturnValue(chain(null));
    await expect(service.context(String(taskId), user)).rejects.toMatchObject({
      status: 404,
    });
    expect(findOrder).toHaveBeenCalledWith({
      _id: sourceId,
      linkedTask: taskId,
      reviewStatus: 'ACCEPTED',
    });
  });
});
