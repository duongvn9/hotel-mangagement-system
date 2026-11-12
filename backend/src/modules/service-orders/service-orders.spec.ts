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
  const userLookup = vi.fn(() => query(null));
  const service = new ServiceOrdersService(
    {
      findById,
      findOneAndUpdate,
      updateOne: vi.fn(async () => ({ modifiedCount: 1 })),
    } as never,
    {
      findById: () => query(null),
      find: () => query([]),
      updateOne: vi.fn(async () => ({ modifiedCount: 1 })),
    } as never,
    {} as never,
    {} as never,
    {
      findById: userLookup,
      findOne: () => ({ lean: async () => ({ _id: assigneeId }) }),
      find: () => query([]),
    } as never,
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
    userLookup,
  };
};

describe('new assignment deadlines', () => {
  it.each([-86400000, -60000, 0])(
    'rejects new service deadline offset %s',
    async (offset) => {
      const f = assignmentFixture('NOT_STARTED');
      await expect(
        f.service.assign(
          String(f.row._id),
          { ...f.input, dueAt: new Date(Date.now() + offset).toISOString() },
          f.actor,
        ),
      ).rejects.toThrow('future');
      expect(f.findOneAndUpdate).not.toHaveBeenCalled();
    },
  );

  it('replays an accepted service assignment after deadline expiry', async () => {
    const f = assignmentFixture();
    vi.spyOn(Date, 'now').mockReturnValue(
      f.row.assignmentDueAt.getTime() + 60000,
    );
    try {
      await f.service.assign(String(f.row._id), f.input, f.actor);
      expect(f.create).not.toHaveBeenCalled();
    } finally {
      vi.restoreAllMocks();
    }
  });
});

describe('service orders read fixes', () => {
  const fixture = () => {
    const bookingId = new Types.ObjectId(dto.bookingId);
    const roomIds = [
      new Types.ObjectId(),
      new Types.ObjectId(),
      new Types.ObjectId(),
    ];
    const row = {
      _id: new Types.ObjectId(),
      booking: bookingId,
      customer: new Types.ObjectId(user.id),
      service: new Types.ObjectId(dto.serviceId),
      serviceName: 'Laundry',
      reviewStatus: 'REJECTED',
      reviewReason: 'Unavailable today',
      executionStatus: 'NOT_STARTED',
      reviewedBy: new Types.ObjectId(),
      reviewDecision: 'REJECT',
      billedInvoiceId: new Types.ObjectId(),
      acceptanceRecovery: undefined as
        { rejectionReason: string; reason: string } | undefined,
    };
    const query = (value: unknown) => {
      const chain = {
        select: vi.fn(() => chain),
        sort: () => chain,
        skip: () => chain,
        limit: () => chain,
        exec: async () => value,
      };
      return chain;
    };
    const orders = {
      findOne: vi.fn(() => query(row)),
      findById: vi.fn(() => query(row)),
      find: vi.fn(() => query([row])),
      countDocuments: () => query(1),
    };
    const booking = {
      _id: bookingId,
      code: 'BK001',
      rooms: roomIds,
      isActive: false,
    };
    const roomFind = vi.fn(() => ({
      toArray: async () => [
        { _id: roomIds[1], roomNumber: '202', isActive: false },
        { _id: roomIds[0], roomNumber: '201', isActive: true },
      ],
    }));
    const bookings = {
      findOne: vi.fn(() => query(booking)),
      findById: vi.fn(() => query(booking)),
      find: vi.fn(() => query([booking])),
      db: { collection: vi.fn(() => ({ find: roomFind })) },
    };
    const users = {
      findById: vi.fn(() => query({ fullName: 'Customer' })),
      find: vi.fn(() => query([{ _id: row.customer, fullName: 'Customer' }])),
    };
    const invoices = { addCharge: vi.fn(), getOrCreateForBooking: vi.fn() };
    const tasks = { create: vi.fn() };
    const service = new ServiceOrdersService(
      orders as never,
      bookings as never,
      {} as never,
      invoices as never,
      users as never,
      tasks as never,
      {} as never,
    );
    return { service, row, orders, bookings, users, roomFind, invoices, tasks };
  };

  it('includes safe booking labels in customer detail and list without staff audit fields', async () => {
    const f = fixture();
    const detail = await f.service.findOne(String(f.row._id), user);
    const list = await f.service.list({ page: 1, limit: 20 }, user);
    for (const result of [detail, list.items[0]]) {
      expect(result).toMatchObject({
        bookingId: String(f.row.booking),
        bookingCode: 'BK001',
        roomNumbers: ['201', '202'],
      });
      for (const key of [
        'booking',
        'customer',
        'review',
        'reviewedBy',
        'reviewedByName',
        'acceptanceRecovery',
        'assignmentIntent',
        'task',
        'invoiceId',
      ])
        expect(result).not.toHaveProperty(key);
    }
    expect(f.users.find).not.toHaveBeenCalled();
  });

  it('returns matching staff detail and list room labels and a nullable reviewer full name', async () => {
    const f = fixture();
    f.users.find.mockImplementation(
      () =>
        ({
          select: () => ({
            exec: async () => [
              { _id: f.row.customer, fullName: 'Customer' },
              { _id: f.row.reviewedBy, fullName: 'Nguyễn Thị An' },
            ],
          }),
        }) as never,
    );
    const actor = { ...user, role: 'RECEPTIONIST' };
    const detail = await f.service.requestDetail(String(f.row._id), actor);
    const list = await f.service.requests({ page: 1, limit: 20 }, actor);
    for (const result of [detail, list.items[0]])
      expect(result).toMatchObject({
        bookingCode: 'BK001',
        roomNumbers: ['201', '202'],
        booking: { code: 'BK001', roomNumbers: ['201', '202'] },
        review: {
          reviewedBy: String(f.row.reviewedBy),
          reviewedByName: 'Nguyễn Thị An',
        },
      });
    f.users.find.mockReturnValueOnce({
      select: () => ({ exec: async () => [] }),
    } as never);
    expect(
      await f.service.requestDetail(String(f.row._id), actor),
    ).toMatchObject({
      review: { reviewedByName: null },
    });
  });

  it('uses null booking code and empty room labels for a missing booking', async () => {
    const f = fixture();
    f.bookings.find.mockReturnValueOnce({
      select: () => ({ exec: async () => [] }),
    } as never);
    expect(
      await f.service.requestDetail(String(f.row._id), {
        ...user,
        role: 'RECEPTIONIST',
      }),
    ).toMatchObject({ bookingCode: null, roomNumbers: [], booking: null });
  });

  it('returns only the rejection reason to the authorized owner without billing or tasks', async () => {
    const f = fixture();
    const result = await f.service.findOne(String(f.row._id), user);
    expect(result).toHaveProperty('reviewReason', 'Unavailable today');
    expect(f.orders.findOne.mock.results[0].value.select).toHaveBeenCalledWith(
      expect.stringContaining('+reviewReason'),
    );
    for (const key of [
      'reviewedBy',
      'review',
      'acceptanceRecovery',
      'invoiceId',
      'billedInvoiceId',
      'task',
    ])
      expect(result).not.toHaveProperty(key);
    expect(f.invoices.addCharge).not.toHaveBeenCalled();
    expect(f.tasks.create).not.toHaveBeenCalled();
    expect(f.orders.findOne).toHaveBeenCalledWith({
      _id: f.row._id,
      customer: f.row.customer,
    });
    expect(f.bookings.findOne).toHaveBeenCalledWith({
      _id: f.row.booking,
      customer: f.row.customer,
    });
  });

  it('includes rejection reasons in the owner list and uses only the public recovery rejection reason', async () => {
    const f = fixture();
    f.row.acceptanceRecovery = {
      rejectionReason: 'Service cannot be provided',
      reason: 'Internal reconciliation',
    };
    const result = await f.service.list({ page: 1, limit: 20 }, user);
    expect(result.items[0]).toHaveProperty(
      'reviewReason',
      'Service cannot be provided',
    );
    expect(result.items[0]).not.toHaveProperty('acceptanceRecovery');
  });

  it.each(['PENDING_REVIEW', 'ACCEPTING', 'ACCEPTED'])(
    'omits reviewReason for %s',
    async (status) => {
      const f = fixture();
      f.row.reviewStatus = status;
      expect(
        await f.service.findOne(String(f.row._id), user),
      ).not.toHaveProperty('reviewReason');
    },
  );

  it('denies other customers, noncustomers and missing owned bookings', async () => {
    const f = fixture();
    f.orders.findOne.mockImplementationOnce(
      () =>
        ({
          ...f.orders.findOne.mock.results[0]?.value,
          select: () => ({ exec: async () => null }),
          exec: async () => null,
        }) as never,
    );
    await expect(
      f.service.findOne(String(f.row._id), {
        ...user,
        id: String(new Types.ObjectId()),
      }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      f.service.findOne(String(f.row._id), { ...user, role: 'SERVICE_STAFF' }),
    ).rejects.toMatchObject({ status: 403 });
    f.bookings.findOne.mockReturnValueOnce({ exec: async () => null } as never);
    await expect(
      f.service.findOne(String(f.row._id), user),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('batches receptionist booking, customer and room context including inactive and missing rooms', async () => {
    const f = fixture();
    const missingBookingRow = {
      ...f.row,
      _id: new Types.ObjectId(),
      booking: new Types.ObjectId(),
    };
    f.orders.find.mockImplementation(() => {
      const chain = {
        select: () => chain,
        sort: () => chain,
        skip: () => chain,
        limit: () => chain,
        exec: async () => [f.row, f.row, missingBookingRow],
      };
      return chain as never;
    });
    const result = await f.service.requests(
      { page: 1, limit: 20 },
      { ...user, role: 'RECEPTIONIST' },
    );
    expect(result.items.map((item) => item.booking)).toEqual([
      expect.objectContaining({ code: 'BK001', roomNumbers: ['201', '202'] }),
      expect.objectContaining({ roomNumbers: ['201', '202'] }),
      null,
    ]);
    expect(f.bookings.find).toHaveBeenCalledTimes(1);
    expect(f.users.find).toHaveBeenCalledTimes(1);
    expect(f.roomFind).toHaveBeenCalledTimes(1);
    expect(f.bookings.findById).not.toHaveBeenCalled();
    expect(f.users.findById).not.toHaveBeenCalled();
    expect(f.roomFind.mock.calls[0][0]).not.toHaveProperty('isActive');
  });
});

describe('service orders contract', () => {
  it('resolves a persisted inactive assignee full name without consulting candidates', async () => {
    const f = assignmentFixture();
    f.userLookup.mockReturnValue({
      select: () => ({
        exec: async () => ({ fullName: 'Trần Minh Bình', isActive: false }),
      }),
    } as never);
    const result = await f.service.requestDetail(String(f.row._id), f.actor);
    expect(result.task).toMatchObject({
      assigneeId: f.input.assigneeId,
      assigneeName: 'Trần Minh Bình',
    });
    expect(f.userLookup).toHaveBeenCalledWith(f.task.assignedTo);
  });

  it('preserves the assigned user ID with a null name when the user is missing', async () => {
    const f = assignmentFixture();
    expect(
      await f.service.requestDetail(String(f.row._id), f.actor),
    ).toMatchObject({
      task: { assigneeId: f.input.assigneeId, assigneeName: null },
    });
  });

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
