import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Types } from 'mongoose';
import {
  AssignServiceOrderDto,
  ServiceHistoryQuery,
  CreateServiceOrderDto,
  ListServiceOrdersQuery,
} from './dto/service-order.dto.js';
import { ServiceOrderSchema } from './schemas/service-order.schema.js';
import { ServiceOrdersService } from './service-orders.service.js';

const user = {
  id: String(new Types.ObjectId()),
  email: 'fixture@example.com',
  role: 'CUSTOMER',
};
const dto = {
  bookingId: String(new Types.ObjectId()),
  serviceId: String(new Types.ObjectId()),
  quantity: 2,
};
const model = (value: unknown) => ({
  findOne: () => ({ exec: async () => value }),
  findById: () => ({ exec: async () => value }),
});

const assignmentFixture = (status = 'ASSIGNED') => {
  const actor = { ...user, role: 'RECEPTIONIST' };
  const assigneeId = new Types.ObjectId();
  const taskId = new Types.ObjectId();
  const row = {
    _id: new Types.ObjectId(),
    booking: new Types.ObjectId(),
    customer: new Types.ObjectId(),
    service: new Types.ObjectId(),
    serviceName: 'Laundry',
    quantity: 1,
    unitPriceVND: 100,
    amount: 100,
    reviewStatus: 'ACCEPTED',
    executionStatus: status,
    billedInvoiceId: new Types.ObjectId(),
    billedAt: new Date(),
    assignmentAssignee: assigneeId,
    assignmentRequestedBy: new Types.ObjectId(actor.id),
    assignmentRequestedAt: new Date('2026-10-01T10:00:00Z'),
    assignmentDueAt: new Date('2026-12-01T10:00:00Z'),
    assignmentTitle: 'Service order: Laundry',
    assignmentTaskId: taskId,
    linkedTask: taskId,
    assignmentRecoveryAudit: [
      {
        actor: new Types.ObjectId(actor.id),
        at: new Date(),
        previousAssignee: new Types.ObjectId(),
        assignee: assigneeId,
        reason: 'Inactive worker replacement',
      },
    ],
  };
  const task = {
    _id: taskId,
    assignedTo: assigneeId,
    assignedAt: row.assignmentRequestedAt,
    dueAt: row.assignmentDueAt,
    title: row.assignmentTitle,
    priority: 'NORMAL',
    status,
  };
  const query = (value: unknown) => ({
    select: () => ({ exec: async () => value }),
  });
  const findById = vi.fn(() => query({ ...row }));
  const findOneAndUpdate = vi.fn(() => query(null));
  const create = vi.fn();
  const findServiceOrderExecutionWork = vi.fn(async () => task);
  const invoice = {
    isActive: true,
    booking: row.booking,
    charges: [
      {
        sourceId: String(row._id),
        type: 'SERVICE',
        amount: row.amount,
        reason: `Service order ${row._id}`,
        approved: true,
      },
    ],
  };
  const invoiceLookup = vi.fn(() => ({ exec: async () => invoice }));
  const service = new ServiceOrdersService(
    {
      findById,
      findOneAndUpdate,
      updateOne: vi.fn(async () => ({ modifiedCount: 1 })),
    } as never,
    {
      findById: () => query(null),
      updateOne: vi.fn(async () => ({ modifiedCount: 1 })),
    } as never,
    {} as never,
    {} as never,
    { findById: () => query(null) } as never,
    {
      create,
      findServiceOrderExecutionWork,
      repairServiceOrderExecution: vi.fn(),
    } as never,
    { findById: invoiceLookup } as never,
  );
  const input = {
    assigneeId: String(assigneeId),
    dueAt: row.assignmentDueAt.toISOString(),
  };
  return {
    service,
    row,
    task,
    actor,
    input,
    findById,
    findOneAndUpdate,
    create,
    invoice,
    invoiceLookup,
  };
};

describe('service orders contract', () => {
  it.each(['ASSIGNED', 'IN_PROGRESS', 'COMPLETED'])(
    'replays the same finalized assignment at %s without writes or regression',
    async (status) => {
      const f = assignmentFixture(status);
      const result = await f.service.assign(
        String(f.row._id),
        f.input,
        f.actor,
      );
      expect(result).toMatchObject({
        id: String(f.row._id),
        executionStatus: status,
        billingStatus: 'BILLED',
        task: {
          id: String(f.task._id),
          status,
          assigneeId: f.input.assigneeId,
          dueAt: f.row.assignmentDueAt,
        },
      });
      expect(f.invoiceLookup).toHaveBeenCalled();
      expect(f.create).not.toHaveBeenCalled();
      expect(f.findOneAndUpdate).not.toHaveBeenCalled();
    },
  );

  it.each(['ASSIGNED', 'IN_PROGRESS', 'COMPLETED'])(
    'replays lost recovery responses at %s without another audit or Task',
    async (status) => {
      const f = assignmentFixture(status);
      const before = [...f.row.assignmentRecoveryAudit];
      await expect(
        f.service.assign(
          String(f.row._id),
          { ...f.input, recoveryReason: 'Inactive worker replacement' },
          { ...f.actor, id: String(new Types.ObjectId()) },
        ),
      ).resolves.toMatchObject({
        executionStatus: status,
        task: { id: String(f.task._id) },
      });
      await expect(
        f.service.assign(
          String(f.row._id),
          { ...f.input, recoveryReason: 'Different intent' },
          f.actor,
        ),
      ).rejects.toMatchObject({ status: 409 });
      expect(f.row.assignmentRecoveryAudit).toEqual(before);
      expect(f.create).not.toHaveBeenCalled();
      expect(f.findOneAndUpdate).not.toHaveBeenCalled();
    },
  );

  it('allows a different receptionist to replay the same finalized intent', async () => {
    const f = assignmentFixture();
    const requester = String(f.row.assignmentRequestedBy);
    await expect(
      f.service.assign(String(f.row._id), f.input, {
        ...f.actor,
        id: String(new Types.ObjectId()),
      }),
    ).resolves.toMatchObject({ executionStatus: 'ASSIGNED' });
    expect(String(f.row.assignmentRequestedBy)).toBe(requester);
    expect(f.create).not.toHaveBeenCalled();
  });

  it.each(['assignee', 'dueAt', 'billing', 'link', 'task'])(
    'rejects finalized replay with different %s',
    async (difference) => {
      const f = assignmentFixture();
      if (difference === 'assignee')
        f.input.assigneeId = String(new Types.ObjectId());
      if (difference === 'dueAt') f.input.dueAt = '2026-12-02T10:00:00.000Z';
      if (difference === 'billing') f.invoice.charges = [];
      if (difference === 'link') f.row.linkedTask = new Types.ObjectId();
      if (difference === 'task') f.task.title = 'Different work';
      await expect(
        f.service.assign(String(f.row._id), f.input, f.actor),
      ).rejects.toMatchObject({ status: 409 });
      expect(f.create).not.toHaveBeenCalled();
      expect(f.findOneAndUpdate).not.toHaveBeenCalled();
    },
  );

  it.each([
    'same',
    'assignee',
    'dueAt',
    'actor',
    'taskId',
    'link',
    'title',
    'requestedAt',
    'task',
    'billing',
  ])(
    'verifies canonical intent and task after losing concurrent finalization: %s',
    async (difference) => {
      const f = assignmentFixture('COMPLETED');
      const pending = () => ({
        select: () => ({
          exec: async () => ({
            ...f.row,
            executionStatus: 'ASSIGNING',
            linkedTask: undefined,
          }),
        }),
      });
      f.findById
        .mockImplementationOnce(pending)
        .mockImplementationOnce(pending);
      f.findOneAndUpdate.mockImplementationOnce(() => {
        if (difference === 'assignee')
          f.row.assignmentAssignee = new Types.ObjectId();
        if (difference === 'dueAt')
          f.row.assignmentDueAt = new Date('2026-12-03T10:00:00Z');
        if (difference === 'actor')
          f.row.assignmentRequestedBy = new Types.ObjectId();
        if (difference === 'taskId') {
          f.row.assignmentTaskId = new Types.ObjectId();
          f.row.linkedTask = f.row.assignmentTaskId;
        }
        if (difference === 'link') f.row.linkedTask = new Types.ObjectId();
        if (difference === 'title') f.row.assignmentTitle = 'Changed';
        if (difference === 'requestedAt')
          f.row.assignmentRequestedAt = new Date();
        if (difference === 'task') f.task.title = 'Changed task';
        if (difference === 'billing') f.invoice.charges = [];
        return { select: () => ({ exec: async () => null }) };
      });
      const result = f.service.assign(String(f.row._id), f.input, f.actor);
      if (difference === 'same')
        await expect(result).resolves.toMatchObject({
          executionStatus: 'COMPLETED',
          task: { id: String(f.task._id), status: 'COMPLETED' },
        });
      else await expect(result).rejects.toMatchObject({ status: 409 });
      expect(f.create).not.toHaveBeenCalled();
      expect(f.findOneAndUpdate).toHaveBeenCalledTimes(1);
    },
  );

  it('validates assignment and history contracts without nullable or foreign fields', async () => {
    for (const payload of [
      { assigneeId: user.id, dueAt: null },
      { assigneeId: 'bad' },
      { assigneeId: user.id, title: 'override' },
      { assigneeId: user.id, dueAt: 'not-a-date' },
    ])
      expect(
        (
          await validate(plainToInstance(AssignServiceOrderDto, payload), {
            whitelist: true,
            forbidNonWhitelisted: true,
          })
        ).length,
      ).toBeGreaterThan(0);
    expect(
      await validate(
        plainToInstance(AssignServiceOrderDto, { assigneeId: user.id }),
      ),
    ).toHaveLength(0);
    for (const payload of [
      { page: 0 },
      { limit: 101 },
      { from: null },
      { to: 'bad' },
    ])
      expect(
        (await validate(plainToInstance(ServiceHistoryQuery, payload))).length,
      ).toBeGreaterThan(0);
  });

  it('uses the Task source collection and real partial customer/key unique index', () => {
    expect(ServiceOrderSchema.get('collection')).toBe('serviceorders');
    expect(ServiceOrderSchema.indexes()).toEqual(
      expect.arrayContaining([
        [
          { customer: 1, requestId: 1 },
          expect.objectContaining({
            unique: true,
            partialFilterExpression: { requestId: { $exists: true } },
          }),
        ],
      ]),
    );
  });

  it('allows optional time but rejects null and client extras', async () => {
    expect(
      await validate(plainToInstance(CreateServiceOrderDto, dto)),
    ).toHaveLength(0);
    for (const extra of [
      { quantity: 0 },
      { quantity: '2' },
      { requestedTime: null },
      { customer: user.id },
      { amount: 0 },
    ])
      expect(
        (
          await validate(
            plainToInstance(CreateServiceOrderDto, { ...dto, ...extra }),
            { whitelist: true, forbidNonWhitelisted: true },
          )
        ).length,
      ).toBeGreaterThan(0);
    expect(
      await validate(
        plainToInstance(ListServiceOrdersQuery, { page: '2', limit: '5' }),
      ),
    ).toHaveLength(0);
  });

  it('verifies persisted billing through the Invoice model without invoking H7 writes or creation', async () => {
    const billedInvoiceId = new Types.ObjectId();
    const row = {
      _id: new Types.ObjectId(),
      booking: new Types.ObjectId(),
      reviewStatus: 'ACCEPTED',
      executionStatus: 'NOT_STARTED',
      quantity: 1,
      unitPriceVND: 100,
      amount: 100,
      billedInvoiceId,
      billedAt: new Date(),
    };
    const getOrCreateForBooking = vi.fn();
    const addCharge = vi.fn();
    const findById = vi.fn().mockReturnValue({ exec: async () => null });
    const service = new ServiceOrdersService(
      {
        findById: () => ({ select: () => ({ exec: async () => row }) }),
      } as never,
      {} as never,
      {} as never,
      { getOrCreateForBooking, addCharge } as never,
      {} as never,
      {} as never,
      { findById } as never,
    );
    const receptionist = { ...user, role: 'RECEPTIONIST' };
    await expect(
      service.assignees(String(row._id), receptionist),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      service.assign(String(row._id), { assigneeId: user.id }, receptionist),
    ).rejects.toMatchObject({ status: 409 });
    expect(findById).toHaveBeenCalledTimes(2);
    expect(findById).toHaveBeenCalledWith(billedInvoiceId);
    expect(getOrCreateForBooking).not.toHaveBeenCalled();
    expect(addCharge).not.toHaveBeenCalled();
  });

  it('enforces Customer inside service independently of HTTP guards', async () => {
    const service = new ServiceOrdersService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    await expect(
      service.create(dto, { ...user, role: 'MANAGER' }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(service.create(dto, undefined as never)).rejects.toMatchObject(
      { status: 401 },
    );
  });

  it('enforces exact Receptionist inside every staff service entry point', async () => {
    const service = new ServiceOrdersService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    for (const role of [
      'CUSTOMER',
      'MANAGER',
      'SERVICE_STAFF',
      'OPERATIONS_STAFF',
    ]) {
      const staff = { ...user, role };
      await expect(
        service.requests(new ListServiceOrdersQuery(), staff),
      ).rejects.toMatchObject({ status: 403 });
      await expect(
        service.requestDetail(dto.bookingId, staff),
      ).rejects.toMatchObject({ status: 403 });
      await expect(
        service.review(dto.bookingId, { decision: 'ACCEPT' }, staff),
      ).rejects.toMatchObject({ status: 403 });
    }
    await expect(
      service.review(dto.bookingId, { decision: 'ACCEPT' }, undefined as never),
    ).rejects.toMatchObject({ status: 401 });
  });

  it.each([null, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])(
    'rejects unusable billable price %s without creating',
    async (price) => {
      const create = vi.fn();
      const service = new ServiceOrdersService(
        { create } as never,
        model({ isActive: true, status: 'CHECKED_IN' }) as never,
        model({ isActive: true, billable: true, price }) as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
      );
      await expect(service.create(dto, user)).rejects.toMatchObject({
        status: 400,
      });
      expect(create).not.toHaveBeenCalled();
    },
  );
});
