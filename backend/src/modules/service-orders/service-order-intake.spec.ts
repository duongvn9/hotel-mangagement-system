import { randomUUID } from 'node:crypto';
import { Types } from 'mongoose';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ServiceOrdersService } from './service-orders.service.js';
import {
  IntakeServiceOrderDto,
  ReviewServiceOrderDto,
} from './dto/service-order.dto.js';
import { ServiceOrderReviewStatus } from './service-order-status.js';
import { ServiceOrderSchema } from './schemas/service-order.schema.js';
import { model } from 'mongoose';

describe('expired acceptance recovery contract', () => {
  it('validates the explicit recovery action and exposes a distinct terminal status', async () => {
    const dto = plainToInstance(ReviewServiceOrderDto, {
      decision: 'REJECT',
      reason: 'Appointment missed',
      recoveryReason: 'Verified no charge or work',
      recoveryAction: 'ABANDON_EXPIRED',
    });
    expect(
      await validate(dto, { whitelist: true, forbidNonWhitelisted: true }),
    ).toEqual([]);
    expect(Object.values(ServiceOrderReviewStatus)).toContain('ABANDONED');
  });

  it('persists explicit recovery audit evidence without losing original intent', () => {
    const Order = model('ExpiredRecoverySchemaTest', ServiceOrderSchema);
    const row = new Order({
      booking: new Types.ObjectId(),
      service: new Types.ObjectId(),
      serviceName: 'Laundry',
      quantity: 1,
      unitPriceVND: 0,
      amount: 0,
      requestedTime: new Date(),
      reviewStatus: 'ABANDONED',
      acceptanceRecovery: {
        decision: 'REJECT',
        action: 'ABANDON_EXPIRED',
        reason: 'Verified',
        rejectionReason: 'Missed',
        actor: new Types.ObjectId(),
        actorRole: 'RECEPTIONIST',
        at: new Date(),
        previousReviewStatus: 'ACCEPTING',
        resultingReviewStatus: 'ABANDONED',
        evidence: {
          chargeExpected: false,
          sourceChargeAbsent: true,
          taskAbsent: true,
        },
      },
    });
    expect(row.validateSync()).toBeUndefined();
    expect(row.toObject().acceptanceRecovery).toMatchObject({
      action: 'ABANDON_EXPIRED',
      actorRole: 'RECEPTIONIST',
      previousReviewStatus: 'ACCEPTING',
      resultingReviewStatus: 'ABANDONED',
      evidence: {
        chargeExpected: false,
        sourceChargeAbsent: true,
        taskAbsent: true,
      },
    });
  });
});

import { TasksService } from '../tasks/tasks.service.js';

const query = (value: unknown) => ({
  exec: async () => value,
  select: () => query(value),
});
const fixture = () => {
  const actor = {
    id: String(new Types.ObjectId()),
    email: 'staff@example.com',
    role: 'SERVICE_STAFF',
  };
  const booking = {
    _id: new Types.ObjectId(),
    isActive: true,
    status: 'CHECKED_IN',
    checkIn: new Date(Date.now() - 86400000),
    checkOut: new Date(Date.now() + 86400000),
    rooms: [new Types.ObjectId()],
  };
  const rows: Record<string, unknown>[] = [];
  const create = vi.fn(async (input) => {
    const row = {
      _id: new Types.ObjectId(),
      reviewStatus: 'PENDING_REVIEW',
      executionStatus: 'NOT_STARTED',
      ...input,
    };
    rows.push(row);
    return row;
  });
  const service = new ServiceOrdersService(
    {
      findOne: (filter) =>
        query(rows.find((row) => row.intakeKey === filter.intakeKey) ?? null),
      create,
    } as never,
    { findOne: () => query(booking) } as never,
    {
      findById: () =>
        query({ name: 'Laundry', unit: 'kg', price: 50000, isActive: true }),
    } as never,
    {} as never,
    {
      findOne: () =>
        query({
          _id: new Types.ObjectId(actor.id),
          isActive: true,
          role: 'SERVICE_STAFF',
        }),
    } as never,
    {} as never,
    {} as never,
  );
  vi.spyOn(service as never, 'staffResponse' as never).mockImplementation(
    (async (row: unknown) => row) as never,
  );
  const input = {
    bookingId: String(booking._id),
    serviceId: String(new Types.ObjectId()),
    quantity: 2,
    requestId: randomUUID(),
    intakeMode: 'UNPERFORMED' as const,
  };
  return { actor, booking, service, input, create, rows };
};

describe('ServiceOrder selected-room task summaries', () => {
  it.each([true, false])(
    'uses selected room only when present=%s, otherwise legacy rooms',
    async (selected) => {
      const first = new Types.ObjectId();
      const second = new Types.ObjectId();
      const tasks = new TasksService(
        ...([] as unknown as ConstructorParameters<typeof TasksService>),
      );
      const roomFind = vi.fn((filter) => ({
        toArray: async () =>
          filter._id.$in.map((id: Types.ObjectId) => ({
            _id: id,
            roomNumber: String(id) === String(first) ? '101' : '202',
          })),
      }));
      (tasks as any).connection = {
        collection: (name: string) =>
          name === 'serviceorders'
            ? {
                findOne: async () => ({
                  serviceName: 'Laundry',
                  booking: new Types.ObjectId(),
                  ...(selected ? { room: second } : {}),
                }),
              }
            : name === 'bookings'
              ? {
                  findOne: async () => ({ code: 'BK', rooms: [first, second] }),
                }
              : { find: roomFind },
      };
      const summary = await (tasks as any).serviceOrderSummary({
        _id: new Types.ObjectId(),
        sourceId: new Types.ObjectId(),
        sourceType: 'SERVICE_ORDER',
        taskType: 'SERVICE_ORDER_EXECUTION',
      });
      expect(summary).toBe(
        selected ? 'Laundry · BK · 202' : 'Laundry · BK · 101, 202',
      );
    },
  );
});

describe('ServiceOrder canonical reassignment', () => {
  it.each(['IN_PROGRESS', 'COMPLETED', 'CANCELLED'])(
    'rejects %s task without changing canonical work',
    async (status) => {
      const tasks = new TasksService(
        ...([] as unknown as ConstructorParameters<typeof TasksService>),
      );
      const task = {
        _id: new Types.ObjectId(),
        status,
        assignedTo: new Types.ObjectId(),
      };
      (tasks as any).tasks = { findOne: () => ({ lean: async () => task }) };
      await expect(
        tasks.reassignServiceOrderExecution(
          new Types.ObjectId().toString(),
          task._id,
          {
            requestId: randomUUID(),
            assigneeId: new Types.ObjectId().toString(),
            expectedAssigneeId: String(task.assignedTo),
            reason: 'Coverage',
          },
          new Types.ObjectId().toString(),
        ),
      ).rejects.toThrow();
    },
  );
});

describe('ServiceOrder staff intake', () => {
  it('blocks task assignment for completed-on-site even when accepted', async () => {
    const f = fixture();
    await expect(
      (f.service as any).assertAssignable({
        intakeMode: 'COMPLETED_ON_SITE',
        reviewStatus: 'ACCEPTED',
      }),
    ).rejects.toThrow('cannot have a task');
  });

  it.each(['CUSTOMER', 'MANAGER', 'OPERATIONS_STAFF'])(
    'rejects intake role %s',
    async (role) => {
      const f = fixture();
      await expect(
        f.service.intake(f.input, { ...f.actor, role }),
      ).rejects.toThrow();
      expect(f.create).not.toHaveBeenCalled();
    },
  );

  it('snapshots server price and reporter without accepting ServiceStaff reports', async () => {
    const f = fixture();
    const row = await f.service.intake(f.input, f.actor);
    expect(row).toMatchObject({
      amount: 100000,
      reviewStatus: 'PENDING_REVIEW',
      intakeMode: 'UNPERFORMED',
    });
    expect(String(f.rows[0].reportedBy)).toBe(f.actor.id);
    expect(f.rows[0]).not.toHaveProperty('linkedTask');
  });

  it('replays a staff-scoped UUID and conflicts on changed content', async () => {
    const f = fixture();
    await f.service.intake(f.input, f.actor);
    await f.service.intake(f.input, f.actor);
    expect(f.create).toHaveBeenCalledTimes(1);
    await expect(
      f.service.intake({ ...f.input, quantity: 3 }, f.actor),
    ).rejects.toThrow('different payload');
  });

  it.each(['CONFIRMED', 'CHECKED_OUT', 'CANCELLED'])(
    'rejects staff reporting for %s',
    async (status) => {
      const f = fixture();
      f.booking.status = status;
      await expect(f.service.intake(f.input, f.actor)).rejects.toThrow();
      expect(f.create).not.toHaveBeenCalled();
    },
  );

  it('replays original intake after selected room leaves the current booking', async () => {
    const f = fixture();
    const body = { ...f.input, roomId: String(f.booking.rooms[0]) };
    await f.service.intake(body, f.actor);
    f.booking.rooms = [new Types.ObjectId()];
    await expect(f.service.intake(body, f.actor)).resolves.toMatchObject({
      intakeMode: 'UNPERFORMED',
    });
    expect(f.create).toHaveBeenCalledTimes(1);
    await expect(
      f.service.intake(
        { ...body, roomId: String(f.booking.rooms[0]) },
        f.actor,
      ),
    ).rejects.toThrow('different payload');
  });

  it('repairs reporter projections without filtering out stale execution status', async () => {
    const f = fixture();
    const repair = vi
      .spyOn(f.service as any, 'repairExecutionScope')
      .mockResolvedValue(undefined);
    const rows = {
      select: () => ({
        sort: () => ({ skip: () => ({ limit: () => query([]) }) }),
      }),
    };
    (f.service as any).orders = {
      find: () => rows,
      countDocuments: () => query(0),
    };
    await f.service.reports(
      { page: 1, limit: 20, executionStatus: 'COMPLETED' } as never,
      f.actor,
    );
    expect(repair).toHaveBeenCalledWith({
      reportedBy: new Types.ObjectId(f.actor.id),
    });
  });

  it('successfully creates customer legacy request without requestedTime', async () => {
    const f = fixture();
    vi.spyOn(f.service as any, 'response').mockImplementation(
      async (row) => row,
    );
    await expect(
      f.service.create(
        {
          bookingId: f.input.bookingId,
          serviceId: f.input.serviceId,
          quantity: 1,
        },
        { ...f.actor, role: 'CUSTOMER' },
      ),
    ).resolves.toHaveProperty('requestedTime', expect.any(Date));
  });

  it('validates selected room membership', async () => {
    const f = fixture();
    await expect(
      f.service.intake(
        { ...f.input, roomId: String(new Types.ObjectId()) },
        f.actor,
      ),
    ).rejects.toThrow('Room');
  });

  it('rejects inactive or wrong-role actual performers', async () => {
    const f = fixture();
    (f.service as any).users = { findOne: () => query(null) };
    await expect(
      f.service.intake(
        {
          ...f.input,
          intakeMode: 'COMPLETED_ON_SITE',
          actualPerformerId: f.actor.id,
          actualCompletedAt: new Date(Date.now() - 3600000).toISOString(),
          completionDetails: 'Delivered',
        },
        f.actor,
      ),
    ).rejects.toThrow('active ServiceStaff');
  });

  it('validates explicit customer schedules while preserving omitted legacy requestedTime', async () => {
    const f = fixture();
    const customer = { ...f.actor, role: 'CUSTOMER' };
    await expect(
      f.service.create(
        {
          bookingId: f.input.bookingId,
          serviceId: f.input.serviceId,
          quantity: 1,
          requestedTime: new Date(Date.now() + 172800000).toISOString(),
        },
        customer,
      ),
    ).rejects.toThrow('requestedTime');
  });

  it('records actual completion without ever creating task work', async () => {
    const f = fixture();
    const completedAt = new Date(Date.now() - 3600000).toISOString();
    const row = await f.service.intake(
      {
        ...f.input,
        intakeMode: 'COMPLETED_ON_SITE',
        actualPerformerId: f.actor.id,
        actualCompletedAt: completedAt,
        completionDetails: 'Delivered laundry',
      },
      f.actor,
    );
    expect(row).toMatchObject({
      reviewStatus: 'PENDING_REVIEW',
      executionStatus: 'NOT_STARTED',
      completionDetails: 'Delivered laundry',
    });
    expect(f.rows[0]).not.toHaveProperty('linkedTask');
  });

  it.each([-172800000, 3600000])(
    'rejects invalid actual completion offset %s',
    async (offset) => {
      const f = fixture();
      await expect(
        f.service.intake(
          {
            ...f.input,
            intakeMode: 'COMPLETED_ON_SITE',
            actualPerformerId: f.actor.id,
            actualCompletedAt: new Date(Date.now() + offset).toISOString(),
            completionDetails: 'Done',
          },
          f.actor,
        ),
      ).rejects.toThrow();
    },
  );

  it('requires actual performer, completion date and nonblank details together', async () => {
    const f = fixture();
    await expect(
      f.service.intake(
        { ...f.input, intakeMode: 'COMPLETED_ON_SITE' },
        f.actor,
      ),
    ).rejects.toThrow();
  });

  it('reception retries reuse the same order and existing review on every attempt', async () => {
    const f = fixture();
    const review = vi
      .spyOn(f.service, 'review')
      .mockRejectedValueOnce(new Error('billing unavailable'))
      .mockResolvedValue({ reviewStatus: 'ACCEPTED' } as never);
    const actor = { ...f.actor, role: 'RECEPTIONIST' };
    await expect(f.service.intake(f.input, actor)).rejects.toThrow(
      'billing unavailable',
    );
    await expect(f.service.intake(f.input, actor)).resolves.toMatchObject({
      reviewStatus: 'ACCEPTED',
    });
    expect(f.create).toHaveBeenCalledTimes(1);
    expect(review).toHaveBeenCalledTimes(2);
  });

  it('requires a future within-stay requestedTime for confirmed reception intake', async () => {
    const f = fixture();
    f.booking.status = 'CONFIRMED';
    const actor = { ...f.actor, role: 'RECEPTIONIST' };
    vi.spyOn(f.service, 'review').mockResolvedValue({
      reviewStatus: 'ACCEPTED',
    } as never);
    await expect(f.service.intake(f.input, actor)).rejects.toThrow();
    await expect(
      f.service.intake(
        {
          ...f.input,
          requestedTime: new Date(Date.now() + 3600000).toISOString(),
        },
        actor,
      ),
    ).resolves.toMatchObject({ reviewStatus: 'ACCEPTED' });
  });

  it('rejects unknown client actors/prices and requires an intake UUID', async () => {
    for (const change of [
      { requestId: undefined },
      { amount: 1 },
      { reportedBy: new Types.ObjectId().toString() },
    ]) {
      const f = fixture();
      const errors = await validate(
        plainToInstance(IntakeServiceOrderDto, { ...f.input, ...change }),
        { whitelist: true, forbidNonWhitelisted: true },
      );
      expect(errors.length).toBeGreaterThan(0);
    }
  });
});
