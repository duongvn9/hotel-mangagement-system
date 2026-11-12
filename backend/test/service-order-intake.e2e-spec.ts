import { randomUUID } from 'node:crypto';
import { VersioningType, type INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { Model, Types } from 'mongoose';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { Booking } from '../src/modules/bookings/schemas/booking.schema.js';
import { Service } from '../src/modules/services/schemas/service.schema.js';
import { ServiceOrder } from '../src/modules/service-orders/schemas/service-order.schema.js';
import { Task, TaskStatus } from '../src/modules/tasks/schemas/task.schema.js';
import { TasksService } from '../src/modules/tasks/tasks.service.js';
import { User } from '../src/modules/users/schemas/user.schema.js';
import { Invoice } from '../src/modules/invoices/schemas/invoice.schema.js';
import { InvoicesService } from '../src/modules/invoices/invoices.service.js';
import { Room } from '../src/modules/rooms/schemas/room.schema.js';
import { RoomType } from '../src/modules/room-types/schemas/room-type.schema.js';
import { addInspection } from './inspection-fixture.js';
import { CheckInService } from '../src/modules/bookings/check-in.service.js';
import { BookingsService } from '../src/modules/bookings/bookings.service.js';
import { CheckOutService } from '../src/modules/invoices/check-out.service.js';
import { assertServiceOrderTestDatabase } from './test-database.js';

describe('isolated ServiceOrder intake API', () => {
  let app: INestApplication;
  let bookingId: string;
  let serviceId: string;
  let reporter: string;
  let replacement: string;
  const reception = {
    'x-dev-role': 'RECEPTIONIST',
    'x-dev-user-id': String(new Types.ObjectId()),
  };
  const staff = () => ({
    'x-dev-role': 'SERVICE_STAFF',
    'x-dev-user-id': reporter,
  });
  const http = () => request(app.getHttpServer());
  const model = <T>(type: { name: string }) =>
    app.get<Model<T>>(getModelToken(type.name));
  const input = (extra = {}) => ({
    bookingId,
    serviceId,
    quantity: 2,
    requestId: randomUUID(),
    intakeMode: 'UNPERFORMED',
    ...extra,
  });
  const intake = (body: object, auth = staff()) =>
    http().post('/api/v1/service-orders/intake').set(auth).send(body);
  const review = (id: string) =>
    http()
      .patch(`/api/v1/service-orders/${id}/review`)
      .set(reception)
      .send({ decision: 'ACCEPT' });

  beforeAll(async () => {
    assertServiceOrderTestDatabase(process.env);
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    await app.init();
    await Promise.all([model(ServiceOrder).init(), model(Task).init()]);
    reporter = String(
      (
        await model(User).create({
          email: `${randomUUID()}@example.com`,
          fullName: 'Reporter',
          role: 'SERVICE_STAFF',
        })
      )._id,
    );
    replacement = String(
      (
        await model(User).create({
          email: `${randomUUID()}@example.com`,
          fullName: 'Replacement',
          role: 'SERVICE_STAFF',
        })
      )._id,
    );
    serviceId = String(
      (
        await model(Service).create({
          name: 'Laundry',
          price: 50000,
          unit: 'kg',
        })
      )._id,
    );
  }, 60000);

  beforeEach(async () => {
    const room = new Types.ObjectId();
    const booking = await model(Booking).create({
      code: randomUUID(),
      guestName: 'Accountless Guest',
      guestEmail: 'guest@example.com',
      guestPhone: '0123456789',
      rooms: [room],
      checkIn: new Date(Date.now() - 86400000),
      checkOut: new Date(Date.now() + 86400000),
      adultCount: 1,
      status: 'CHECKED_IN',
      roomTotal: 0,
      depositAmount: 0,
      rateSnapshot: [{ room, ratePerNight: 100000 }],
    });
    bookingId = String(booking._id);
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('reports pending, bills once, auto-assigns canonical work and retries review', async () => {
    const body = input();
    const created = await intake(body).expect(201);
    expect(created.body.reviewStatus).toBe('PENDING_REVIEW');
    expect(created.body.reportedBy).toBe(reporter);
    const accepted = await review(created.body.id).expect(200);
    expect(accepted.body.task.assigneeId).toBe(reporter);
    await review(created.body.id).expect(200);
    await intake(body).expect(201);
    expect(
      await model(Task).countDocuments({
        sourceId: new Types.ObjectId(created.body.id),
      }),
    ).toBe(1);
    const invoice = await model(Invoice)
      .findOne({ booking: new Types.ObjectId(bookingId) })
      .orFail();
    expect(
      invoice.charges.filter((charge) => charge.sourceId === created.body.id),
    ).toHaveLength(1);
  });

  it('completed-on-site accepts as COMPLETED without any task, and stays in reporter detail', async () => {
    const created = await intake(
      input({
        intakeMode: 'COMPLETED_ON_SITE',
        actualPerformerId: replacement,
        actualCompletedAt: new Date(Date.now() - 3600000).toISOString(),
        completionDetails: 'Laundry delivered',
      }),
    ).expect(201);
    const accepted = await review(created.body.id).expect(200);
    expect(accepted.body.executionStatus).toBe('COMPLETED');
    expect(accepted.body.task).toBeNull();
    expect(
      await model(Task).countDocuments({
        sourceId: new Types.ObjectId(created.body.id),
      }),
    ).toBe(0);
    await http()
      .post(`/api/v1/service-orders/${created.body.id}/assignment`)
      .set(reception)
      .send({ assigneeId: reporter })
      .expect(409);
    const detail = await http()
      .get(`/api/v1/service-orders/reports/${created.body.id}`)
      .set(staff())
      .expect(200);
    expect(detail.body.actualPerformerId).toBe(replacement);
    expect(detail.body.completionDetails).toBe('Laundry delivered');
    const history = await http()
      .get(`/api/v1/service-orders/history/${created.body.id}`)
      .set({ ...staff(), 'x-dev-user-id': replacement })
      .expect(200);
    expect(history.body.actualCompletedAt).toBe(detail.body.actualCompletedAt);
    expect(history.body.task).toBeNull();
    await http()
      .get(`/api/v1/service-orders/reports/${created.body.id}`)
      .set({ ...staff(), 'x-dev-user-id': replacement })
      .expect(404);
  });

  it('reception auto-accepts confirmed future schedules and rejects unscheduled confirmed intake', async () => {
    await model(Booking).updateOne({ _id: bookingId }, { status: 'CONFIRMED' });
    await intake(input(), reception).expect(400);
    const result = await intake(
      input({ requestedTime: new Date(Date.now() + 3600000).toISOString() }),
      reception,
    ).expect(201);
    expect(result.body.reviewStatus).toBe('ACCEPTED');
    expect(result.body.task).toBeNull();
  });

  it('carries a future confirmed accepted service through checked-in charges, payment and actual checkout', async () => {
    const type = await model(RoomType).create({
      name: `Intake checkout ${randomUUID()}`,
      adultCapacity: 2,
      childCapacity: 0,
      basePrice: 100000,
    });
    const room = await model(Room).create({
      roomNumber: `INT-${randomUUID()}`,
      floor: 1,
      roomType: type._id,
      status: 'OCCUPIED',
    });
    const checkIn = new Date('2098-06-10T00:00:00+07:00');
    const checkOut = new Date('2098-06-11T00:00:00+07:00');
    await model(Booking).updateOne(
      { _id: bookingId },
      {
        status: 'CONFIRMED',
        rooms: [room._id],
        checkIn,
        checkOut,
        rateSnapshot: [{ room: room._id, ratePerNight: 100000 }],
      },
    );
    const created = await intake(
      input({ requestedTime: '2098-06-10T12:00:00+07:00' }),
      reception,
    ).expect(201);
    expect(created.body.reviewStatus).toBe('ACCEPTED');
    const persisted = await model(Invoice)
      .findOne({ booking: new Types.ObjectId(bookingId) })
      .orFail();
    expect(
      persisted.charges.filter((entry) => entry.sourceId === created.body.id),
    ).toHaveLength(1);
    expect(persisted.serviceTotal).toBe(100000);
    await model(Booking).updateOne(
      { _id: bookingId },
      { status: 'CHECKED_IN' },
    );
    const charges = await http()
      .get(`/api/v1/bookings/${bookingId}/charges`)
      .set(reception)
      .expect(200);
    expect(charges.body.totals).toMatchObject({
      roomTotal: 100000,
      serviceTotal: 100000,
      totalAmount: 200000,
      balanceDue: 200000,
    });
    const path = `/api/v1/bookings/${bookingId}/check-out`;
    await http().post(path).set(reception).expect(409);
    await addInspection(model(Task), bookingId);
    await http()
      .post(`/api/v1/bookings/${bookingId}/charges/confirm`)
      .set(reception)
      .expect(201);
    await http().post(path).set(reception).expect(409);
    await http()
      .post(`/api/v1/bookings/${bookingId}/payments/cash`)
      .set(reception)
      .send({ requestId: randomUUID() })
      .expect(201);
    const result = await http().post(path).set(reception).expect(201);
    expect(result.body.status).toBe('CHECKED_OUT');
    expect(result.body.invoice.totals).toMatchObject({
      serviceTotal: 100000,
      totalAmount: 200000,
      balanceDue: 0,
    });
    expect((await model(Room).findById(room._id).orFail()).status).toBe(
      'CLEANING',
    );
  });

  it('preserves direct catalog charging independently of ServiceOrder intake', async () => {
    const path = `/api/v1/bookings/${bookingId}/charges/services`;
    const body = { requestId: randomUUID(), serviceId, quantity: 3 };
    const result = await http()
      .post(path)
      .set(reception)
      .send(body)
      .expect(201);
    expect(result.body.totals.serviceTotal).toBe(150000);
    await http().post(path).set(reception).send(body).expect(201);
    await http()
      .post(path)
      .set(reception)
      .send({ ...body, quantity: 4 })
      .expect(409);
    const invoice = await model(Invoice)
      .findOne({ booking: new Types.ObjectId(bookingId) })
      .orFail();
    expect(invoice.charges).toHaveLength(1);
    expect(
      await model(ServiceOrder).countDocuments({
        booking: new Types.ObjectId(bookingId),
      }),
    ).toBe(0);
    expect(
      await model(Task).countDocuments({
        sourceId: new Types.ObjectId(bookingId),
      }),
    ).toBe(0);
    await model(Booking).updateOne({ _id: bookingId }, { status: 'CONFIRMED' });
    await http()
      .post(path)
      .set(reception)
      .send({ ...body, requestId: randomUUID() })
      .expect(409);
  });

  it('billing failure leaves ACCEPTING, retries same UUID without duplicate charge', async () => {
    const body = input();
    const billing = vi
      .spyOn(app.get(InvoicesService), 'addCharge')
      .mockRejectedValueOnce(new Error('temporary billing failure'));
    await intake(body, reception).expect(503);
    const row = await model(ServiceOrder)
      .findOne({ booking: new Types.ObjectId(bookingId) })
      .orFail();
    expect(row.reviewStatus).toBe('ACCEPTING');
    billing.mockRestore();
    const retry = await intake(body, reception).expect(201);
    expect(retry.body.id).toBe(String(row._id));
    expect(retry.body.reviewStatus).toBe('ACCEPTED');
    expect(
      await model(ServiceOrder).countDocuments({
        booking: new Types.ObjectId(bookingId),
      }),
    ).toBe(1);
  });

  it('reassigns the same Task atomically with audit, preserves billing and rejects started work', async () => {
    const created = await intake(input()).expect(201);
    const accepted = await review(created.body.id).expect(200);
    const taskId = accepted.body.task.id;
    const before = await model(Task).findById(taskId).orFail();
    const candidatesPath = `/api/v1/service-orders/${created.body.id}/assignees`;
    const candidates = await http()
      .get(candidatesPath)
      .set(reception)
      .expect(200);
    expect(candidates.body.recoveryAllowed).toBe(false);
    expect(candidates.body.items).toContainEqual({
      id: replacement,
      displayName: 'Replacement',
      role: 'SERVICE_STAFF',
    });
    const body = {
      requestId: randomUUID(),
      assigneeId: replacement,
      expectedAssigneeId: reporter,
      reason: 'Shift coverage',
    };
    const path = `/api/v1/service-orders/${created.body.id}/reassignment`;
    const result = await http()
      .post(path)
      .set(reception)
      .send(body)
      .expect(201);
    expect(result.body.task.id).toBe(taskId);
    expect(result.body.task.assigneeId).toBe(replacement);
    await http().post(path).set(reception).send(body).expect(201);
    const after = await model(Task).findById(taskId).orFail();
    expect(after.assignedAt).toEqual(before.assignedAt);
    expect(after.serviceOrderReassignments).toHaveLength(1);
    expect(after.status).toBe('ASSIGNED');
    await http()
      .post(`/api/v1/service-orders/${created.body.id}/assignment`)
      .set(reception)
      .send({ assigneeId: reporter })
      .expect(201);
    await http().get(candidatesPath).set(reception).expect(200);
    await model(Task).updateOne({ _id: taskId }, { status: 'IN_PROGRESS' });
    await http().get(candidatesPath).set(reception).expect(409);
    await http()
      .post(path)
      .set(reception)
      .send({
        ...body,
        requestId: randomUUID(),
        expectedAssigneeId: replacement,
        assigneeId: reporter,
      })
      .expect(409);
    const invoice = await model(Invoice)
      .findOne({ booking: new Types.ObjectId(bookingId) })
      .orFail();
    expect(
      invoice.charges.filter((charge) => charge.sourceId === created.body.id),
    ).toHaveLength(1);
  });

  it('falls back to unassigned when reporter becomes inactive before acceptance', async () => {
    const created = await intake(input()).expect(201);
    await model(User).updateOne({ _id: reporter }, { isActive: false });
    try {
      const accepted = await review(created.body.id).expect(200);
      expect(accepted.body.executionStatus).toBe('NOT_STARTED');
      expect(accepted.body.task).toBeNull();
    } finally {
      await model(User).updateOne({ _id: reporter }, { isActive: true });
    }
  });

  it('returns persisted billing on staff replay and lists eligible actual performers', async () => {
    const body = input();
    const created = await intake(body).expect(201);
    await review(created.body.id).expect(200);
    const replay = await intake(body).expect(201);
    expect(replay.body.billingStatus).toBe('BILLED');
    const performers = await http()
      .get('/api/v1/service-orders/intake/performers')
      .set(staff())
      .expect(200);
    expect(performers.body.items).toContainEqual({
      id: replacement,
      displayName: 'Replacement',
      role: 'SERVICE_STAFF',
    });
  });

  it('keeps customer creation pending and owner-only, permits valid scheduled confirmed review', async () => {
    const customer = new Types.ObjectId();
    await model(Booking).updateOne(
      { _id: bookingId },
      { customer, status: 'CONFIRMED' },
    );
    const auth = {
      'x-dev-role': 'CUSTOMER',
      'x-dev-user-id': String(customer),
    };
    const result = await http()
      .post('/api/v1/service-orders')
      .set(auth)
      .send({
        bookingId,
        serviceId,
        quantity: 1,
        requestedTime: new Date(Date.now() + 3600000).toISOString(),
      })
      .expect(201);
    expect(result.body.reviewStatus).toBe('PENDING_REVIEW');
    await http()
      .get(`/api/v1/service-orders/${result.body.id}`)
      .set({ ...auth, 'x-dev-user-id': reporter })
      .expect(404);
    await review(result.body.id).expect(200);
  });

  it('races task start against reassignment without losing progress or creating replacement work', async () => {
    const created = await intake(input()).expect(201);
    const accepted = await review(created.body.id).expect(200);
    const taskId = accepted.body.task.id;
    const tasks = app.get(TasksService);
    const results = await Promise.allSettled([
      tasks.transitionAssignedTask(
        taskId,
        reporter,
        TaskStatus.Assigned,
        TaskStatus.InProgress,
      ),
      http()
        .post(`/api/v1/service-orders/${created.body.id}/reassignment`)
        .set(reception)
        .send({
          requestId: randomUUID(),
          assigneeId: replacement,
          expectedAssigneeId: reporter,
          reason: 'Coverage',
        }),
    ]);
    const task = await model(Task).findById(taskId).orFail();
    expect(['ASSIGNED', 'IN_PROGRESS']).toContain(task.status);
    if (task.status === 'IN_PROGRESS')
      expect(String(task.assignedTo)).toBe(reporter);
    else expect(String(task.assignedTo)).toBe(replacement);
    expect(results.length).toBe(2);
    expect(
      await model(Task).countDocuments({
        sourceId: new Types.ObjectId(created.body.id),
      }),
    ).toBe(1);
  });

  it('deduplicates concurrent identical intake and reconciles persisted charge after lost acknowledgment', async () => {
    const body = input();
    const results = await Promise.all([intake(body), intake(body)]);
    expect(results.map((result) => result.status)).toEqual([201, 201]);
    expect(results[0].body.id).toBe(results[1].body.id);
    const invoices = app.get(InvoicesService);
    const original = invoices.addCharge.bind(invoices);
    const charge = vi
      .spyOn(invoices, 'addCharge')
      .mockImplementationOnce(async (value) => {
        await original(value);
        throw new Error('Lost acknowledgment');
      });
    try {
      await review(results[0].body.id).expect(200);
      await review(results[0].body.id).expect(200);
      const invoice = await model(Invoice)
        .findOne({ booking: new Types.ObjectId(bookingId) })
        .orFail();
      expect(
        invoice.charges.filter(
          (entry) => entry.sourceId === results[0].body.id,
        ),
      ).toHaveLength(1);
    } finally {
      charge.mockRestore();
    }
  });

  it('blocks new confirmed charge after requested time expires but recovers completed-on-site finalization without tasks', async () => {
    const scheduled = new Date(Date.now() + 3600000);
    await model(Booking).updateOne({ _id: bookingId }, { status: 'CONFIRMED' });
    const body = input({ requestedTime: scheduled.toISOString() });
    const invoices = app.get(InvoicesService);
    const charge = vi
      .spyOn(invoices, 'addCharge')
      .mockRejectedValueOnce(new Error('Unavailable'));
    await intake(body, reception).expect(503);
    charge.mockRestore();
    const clock = vi.useFakeTimers({ toFake: ['Date'] });
    try {
      clock.setSystemTime(new Date(scheduled.getTime() + 1000));
      await intake(body, reception).expect(409);
      const invoice = await model(Invoice)
        .findOne({ booking: new Types.ObjectId(bookingId) })
        .orFail();
      expect(invoice.charges).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
    await model(Booking).updateOne(
      { _id: bookingId },
      { status: 'CHECKED_IN' },
    );
    const completed = await intake(
      input({
        intakeMode: 'COMPLETED_ON_SITE',
        actualPerformerId: replacement,
        actualCompletedAt: new Date(Date.now() - 3600000).toISOString(),
        completionDetails: 'Done',
      }),
    ).expect(201);
    await review(completed.body.id).expect(200);
    await model(ServiceOrder).updateOne(
      { _id: completed.body.id },
      { executionStatus: 'NOT_STARTED' },
    );
    const recovered = await review(completed.body.id).expect(200);
    expect(recovered.body.executionStatus).toBe('COMPLETED');
    expect(
      await model(Task).countDocuments({
        sourceId: new Types.ObjectId(completed.body.id),
      }),
    ).toBe(0);
  });

  const expired = async (amount = 100000) => {
    const now = Date.now();
    await model(Booking).updateOne({ _id: bookingId }, { status: 'CONFIRMED' });
    const row = await model(ServiceOrder).create({
      booking: bookingId,
      service: serviceId,
      serviceName: 'Laundry',
      unit: 'kg',
      quantity: 2,
      unitPriceVND: amount / 2,
      amount,
      requestedTime: new Date(now - 1000),
      reviewStatus: 'ACCEPTING',
      executionStatus: 'NOT_STARTED',
      reviewedBy: new Types.ObjectId(reception['x-dev-user-id']),
      reviewedAt: new Date(now - 2000),
      reviewDecision: 'ACCEPT',
      reviewReason: '',
      intakeRole: 'RECEPTIONIST',
      intakeMode: 'UNPERFORMED',
    });
    await model(Booking).updateOne(
      { _id: bookingId },
      {
        $addToSet: {
          acceptanceReservations: String(row._id),
          financialReconciliationOrderIds: String(row._id),
        },
      },
    );
    return row;
  };
  const abandon = (id: string, extra = {}, auth = reception) =>
    http()
      .patch(`/api/v1/service-orders/${id}/review`)
      .set(auth)
      .send({
        decision: 'REJECT',
        reason: 'Appointment missed',
        recoveryReason: 'Verified no billing or execution',
        recoveryAction: 'ABANDON_EXPIRED',
        ...extra,
      });

  it.each([0, 100000])(
    'explicitly abandons expired %s with immutable audit and replay cleanup',
    async (amount) => {
      const row = await expired(amount);
      await review(String(row._id)).expect(409);
      const result = await abandon(String(row._id)).expect(200);
      expect(result.body.reviewStatus).toBe('ABANDONED');
      expect(result.body.acceptanceRecovery).toMatchObject({
        action: 'ABANDON_EXPIRED',
        actorRole: 'RECEPTIONIST',
        actor: reception['x-dev-user-id'],
        previousReviewStatus: 'ACCEPTING',
        resultingReviewStatus: 'ABANDONED',
        evidence: {
          chargeExpected: amount > 0,
          sourceChargeAbsent: true,
          taskAbsent: true,
        },
      });
      await model(Booking).updateOne(
        { _id: bookingId },
        {
          $addToSet: {
            acceptanceReservations: String(row._id),
            financialReconciliationOrderIds: String(row._id),
          },
        },
      );
      const replay = await abandon(
        String(row._id),
        {},
        { ...reception, 'x-dev-user-id': replacement },
      ).expect(200);
      expect(replay.body.acceptanceRecovery).toEqual(
        result.body.acceptanceRecovery,
      );
      await abandon(String(row._id), { recoveryReason: 'Changed' }).expect(409);
      await review(String(row._id)).expect(409);
      await http()
        .post(`/api/v1/service-orders/${row._id}/assignment`)
        .set(reception)
        .send({ assigneeId: reporter })
        .expect(409);
      const booking = await model(Booking).findById(bookingId).orFail();
      expect(booking.acceptanceReservations).not.toContain(String(row._id));
      expect(booking.financialReconciliationOrderIds).not.toContain(
        String(row._id),
      );
      expect(await model(Task).countDocuments({ sourceId: row._id })).toBe(0);
      expect(
        await model(Invoice).countDocuments({
          'charges.sourceId': String(row._id),
        }),
      ).toBe(0);
      const persisted = await model(ServiceOrder)
        .findById(row._id)
        .select('+reviewedBy +reviewedAt +reviewDecision')
        .orFail();
      expect(persisted.reviewDecision).toBe('ACCEPT');
      expect(persisted.reviewedAt).toEqual(row.reviewedAt);
      expect(String(persisted.reviewedBy)).toBe(String(row.reviewedBy));
    },
  );

  it.each([
    { intakeRole: 'SERVICE_STAFF' },
    { intakeMode: 'COMPLETED_ON_SITE' },
    { executionStatus: 'IN_PROGRESS' },
    { linkedTask: new Types.ObjectId() },
    { assignmentTaskId: new Types.ObjectId() },
    { billedInvoiceId: new Types.ObjectId() },
    { billedAt: new Date() },
    { reviewedAt: new Date(Date.now() + 86400000) },
    { reviewStatus: 'PENDING_REVIEW' },
    { reviewDecision: 'REJECT' },
  ])('fails closed for incompatible order %j', async (change) => {
    const row = await expired();
    await model(ServiceOrder).collection.updateOne(
      { _id: row._id },
      { $set: change },
    );
    await abandon(String(row._id)).expect(409);
    expect(
      (await model(Booking).findById(bookingId).orFail())
        .acceptanceReservations,
    ).toContain(String(row._id));
  });

  it.each(['CHECKED_IN', 'CHECKED_OUT', 'CANCELLED'])(
    'does not extend expired policy to %s',
    async (status) => {
      const row = await expired();
      await model(Booking).updateOne({ _id: bookingId }, { status });
      await abandon(String(row._id)).expect(409);
    },
  );

  it.each(['', ' ', 'x'.repeat(2001)])(
    'rejects invalid recovery reason length %s',
    async (recoveryReason) => {
      const row = await expired();
      await abandon(String(row._id), { recoveryReason }).expect(400);
    },
  );

  it.each(['SERVICE_STAFF', 'CUSTOMER', 'MANAGER'])(
    'denies recovery by %s',
    async (role) => {
      const row = await expired();
      await abandon(
        String(row._id),
        {},
        { ...reception, 'x-dev-role': role },
      ).expect(403);
    },
  );

  it.each([false, true])(
    'rejects globally sourced charge even wrong booking inactive=%s',
    async (inactive) => {
      const row = await expired();
      await model(Invoice).collection.insertOne({
        code: randomUUID(),
        booking: new Types.ObjectId(),
        isActive: !inactive,
        charges: [
          {
            sourceId: String(row._id),
            type: 'SERVICE',
            amount: row.amount,
            approved: true,
          },
        ],
      });
      await abandon(String(row._id)).expect(409);
      expect(
        (await model(Booking).findById(bookingId).orFail())
          .financialReconciliationOrderIds,
      ).toContain(String(row._id));
    },
  );

  it.each(['ASSIGNED', 'COMPLETED', 'CANCELLED'])(
    'rejects any source Task in %s',
    async (status) => {
      const row = await expired();
      await model(Task).collection.insertOne({
        sourceType: 'SERVICE_ORDER',
        sourceId: row._id,
        status,
      });
      await abandon(String(row._id)).expect(409);
    },
  );

  it('serializes two abandonment actors and preserves the first durable audit', async () => {
    const row = await expired();
    const results = await Promise.all([
      abandon(String(row._id)),
      abandon(
        String(row._id),
        {},
        { ...reception, 'x-dev-user-id': replacement },
      ),
    ]);
    expect(results.map((result) => result.status)).toEqual([200, 200]);
    expect(results[0].body.acceptanceRecovery).toEqual(
      results[1].body.acceptanceRecovery,
    );
  });

  it('fails closed when authoritative evidence reads fail', async () => {
    const row = await expired();
    const evidence = vi
      .spyOn(model(Invoice), 'exists')
      .mockImplementationOnce(() => {
        throw new Error('Evidence unavailable');
      });
    try {
      await abandon(String(row._id)).expect(409);
      expect(
        (await model(ServiceOrder).findById(row._id).orFail()).reviewStatus,
      ).toBe('ACCEPTING');
      expect(
        (await model(Booking).findById(bookingId).orFail())
          .financialReconciliationOrderIds,
      ).toContain(String(row._id));
    } finally {
      evidence.mockRestore();
    }
  });

  it('replays durable abandonment after cleanup failure without replacing audit', async () => {
    const row = await expired();
    const bookings = model(Booking);
    const original = bookings.updateOne.bind(bookings);
    const cleanup = vi.spyOn(bookings, 'updateOne').mockImplementation(((
      filter: any,
      update: any,
      ...rest: any[]
    ) => {
      if (update.$pull?.financialReconciliationOrderIds)
        throw new Error('Cleanup unavailable');
      return original(filter, update, ...rest);
    }) as never);
    try {
      await abandon(String(row._id)).expect(503);
    } finally {
      cleanup.mockRestore();
    }
    const persisted = await model(ServiceOrder)
      .findById(row._id)
      .select('+acceptanceRecovery')
      .orFail();
    expect(persisted.reviewStatus).toBe('ABANDONED');
    expect(
      (await model(Booking).findById(bookingId).orFail())
        .financialReconciliationOrderIds,
    ).toContain(String(row._id));
    const replay = await abandon(String(row._id)).expect(200);
    expect(replay.body.acceptanceRecovery.at).toBe(
      persisted.acceptanceRecovery?.at.toISOString(),
    );
    expect(
      (await model(Booking).findById(bookingId).orFail())
        .acceptanceReservations,
    ).not.toContain(String(row._id));
  });

  it('keeps evidence when abandonment CAS fails before decision', async () => {
    const row = await expired();
    const update = vi
      .spyOn(model(ServiceOrder), 'findOneAndUpdate')
      .mockImplementationOnce(() => {
        throw new Error('Decision unavailable');
      });
    try {
      await abandon(String(row._id)).expect(503);
    } finally {
      update.mockRestore();
    }
    expect(
      (await model(ServiceOrder).findById(row._id).orFail()).reviewStatus,
    ).toBe('ACCEPTING');
    expect(
      (await model(Booking).findById(bookingId).orFail())
        .acceptanceReservations,
    ).toContain(String(row._id));
    await abandon(String(row._id)).expect(200);
  });

  it('finalizes exact persisted H7 after expiry and cleans only its own marker', async () => {
    const scheduled = new Date(Date.now() + 3600000);
    await model(Booking).updateOne({ _id: bookingId }, { status: 'CONFIRMED' });
    const invoices = app.get(InvoicesService);
    const original = invoices.addCharge.bind(invoices);
    const charge = vi
      .spyOn(invoices, 'addCharge')
      .mockImplementationOnce(async (value) => {
        await original(value);
        throw new Error('Lost charge acknowledgment');
      });
    const orders = model(ServiceOrder);
    const originalUpdate = orders.findOneAndUpdate.bind(orders);
    const finalize = vi.spyOn(orders, 'findOneAndUpdate').mockImplementation(((
      filter: any,
      update: any,
      ...rest: any[]
    ) => {
      if (update.$set?.reviewStatus === 'ACCEPTED')
        throw new Error('Finalization unavailable');
      return originalUpdate(filter, update, ...rest);
    }) as never);
    const row = await expired();
    await orders.collection.updateOne(
      { _id: row._id },
      { $set: { requestedTime: scheduled } },
    );
    try {
      await review(String(row._id)).expect(503);
    } finally {
      charge.mockRestore();
      finalize.mockRestore();
    }
    const other = String(new Types.ObjectId());
    await model(Booking).updateOne(
      { _id: bookingId },
      {
        $addToSet: {
          financialReconciliationOrderIds: { $each: [String(row._id), other] },
        },
      },
    );
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date(scheduled.getTime() + 1000));
      await abandon(String(row._id)).expect(409);
      const noCharge = vi.spyOn(invoices, 'addCharge');
      try {
        await review(String(row._id)).expect(200);
        expect(noCharge).not.toHaveBeenCalled();
      } finally {
        noCharge.mockRestore();
      }
      const accepted = await orders
        .findById(row._id)
        .select('+reviewedBy +reviewedAt')
        .orFail();
      expect(accepted.reviewStatus).toBe('ACCEPTED');
      expect(accepted.reviewedAt).toEqual(row.reviewedAt);
      expect(String(accepted.reviewedBy)).toBe(String(row.reviewedBy));
      expect(
        (await model(Booking).findById(bookingId).orFail())
          .financialReconciliationOrderIds,
      ).toEqual([other]);
      expect(
        (
          await model(Invoice)
            .findOne({ booking: new Types.ObjectId(bookingId) })
            .orFail()
        ).charges.filter((item) => item.sourceId === String(row._id)),
      ).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('holds abandonment evidence barrier against acceptance and assignment', async () => {
    const row = await expired();
    let release!: () => void;
    let entered!: () => void;
    const reached = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const waiting = new Promise<void>((resolve) => {
      release = resolve;
    });
    const invoices = model(Invoice);
    const original = invoices.exists.bind(invoices);
    const evidence = vi
      .spyOn(invoices, 'exists')
      .mockImplementationOnce((async (filter: any) => {
        entered();
        await waiting;
        return original(filter);
      }) as never);
    const pending = abandon(String(row._id)).then((response) => response);
    try {
      await reached;
      const acceptance = review(String(row._id)).then((response) => response);
      const assignment = http()
        .post(`/api/v1/service-orders/${row._id}/assignment`)
        .set(reception)
        .send({ assigneeId: reporter })
        .then((response) => response);
      release();
      expect((await pending).status).toBe(200);
      expect((await acceptance).status).toBe(409);
      expect((await assignment).status).toBe(409);
      expect(await model(Task).countDocuments({ sourceId: row._id })).toBe(0);
      expect(
        await model(Invoice).countDocuments({
          'charges.sourceId': String(row._id),
        }),
      ).toBe(0);
    } finally {
      release();
      evidence.mockRestore();
    }
  });

  it.each([
    { requestedTime: new Date(Date.now() + 3600000) },
    { requestedTime: new Date(Date.now() - 172800000) },
    { reviewedAt: new Date(Date.now() + 86400000) },
  ])('requires original valid expired scheduling %j', async (change) => {
    const row = await expired();
    await model(ServiceOrder).collection.updateOne(
      { _id: row._id },
      { $set: change },
    );
    await abandon(String(row._id)).expect(409);
    expect(
      (await model(ServiceOrder).findById(row._id).orFail()).reviewStatus,
    ).toBe('ACCEPTING');
  });

  it('replays after a lost durable decision acknowledgment', async () => {
    const row = await expired();
    const orders = model(ServiceOrder);
    const original = orders.findOneAndUpdate.bind(orders);
    const decision = vi
      .spyOn(orders, 'findOneAndUpdate')
      .mockImplementationOnce(((filter: any, update: any, options: any) => ({
        select: (selection: string) => ({
          exec: async () => {
            await original(filter, update, options).select(selection).exec();
            throw new Error('Decision acknowledgment lost');
          },
        }),
      })) as never);
    try {
      await abandon(String(row._id)).expect(503);
    } finally {
      decision.mockRestore();
    }
    const saved = await orders
      .findById(row._id)
      .select('+acceptanceRecovery')
      .orFail();
    expect(saved.reviewStatus).toBe('ABANDONED');
    const replay = await abandon(
      String(row._id),
      {},
      { ...reception, 'x-dev-user-id': replacement },
    ).expect(200);
    expect(replay.body.acceptanceRecovery.actor).toBe(
      reception['x-dev-user-id'],
    );
    expect(replay.body.acceptanceRecovery.at).toBe(
      saved.acceptanceRecovery?.at.toISOString(),
    );
    expect(
      (await model(Booking).findById(bookingId).orFail())
        .financialReconciliationOrderIds,
    ).not.toContain(String(row._id));
  });

  const recoveryRoom = async () => {
    const type = await model(RoomType).create({
      name: randomUUID(),
      adultCapacity: 2,
      childCapacity: 0,
      basePrice: 100000,
    });
    const room = await model(Room).create({
      roomNumber: randomUUID(),
      floor: 1,
      roomType: type._id,
      status: 'AVAILABLE',
    });
    await model(Booking).updateOne(
      { _id: bookingId },
      {
        rooms: [room._id],
        rateSnapshot: [{ room: room._id, ratePerNight: 100000 }],
      },
    );
  };
  const signal = () => {
    let release!: () => void;
    const promise = new Promise<void>((resolve) => {
      release = resolve;
    });
    return { promise, release };
  };
  const bookingOperation = (kind: string) => {
    if (kind === 'checkin')
      return app.get(CheckInService).checkIn(bookingId, {});
    if (kind === 'checkout')
      return app.get(CheckOutService).checkOut(bookingId);
    if (kind === 'cancel')
      return app.get(BookingsService).cancel(bookingId, {
        user: { id: reception['x-dev-user-id'], role: 'RECEPTIONIST' },
      });
    return app.get(BookingsService).update(bookingId, {
      checkIn: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10),
      checkOut: new Date(Date.now() + 4 * 86400000).toISOString().slice(0, 10),
    });
  };

  it.each(['checkin', 'cancel', 'dates', 'checkout'])(
    'serializes abandonment first against actual %s before releasing evidence',
    async (kind) => {
      const row = await expired();
      await recoveryRoom();
      const reached = signal();
      const release = signal();
      const attempted = signal();
      const invoices = model(Invoice);
      const originalExists = invoices.exists.bind(invoices);
      const evidence = vi
        .spyOn(invoices, 'exists')
        .mockImplementationOnce((async (filter: any) => {
          reached.release();
          await release.promise;
          return originalExists(filter);
        }) as never);
      const bookings = model(Booking);
      const originalUpdate = bookings.updateOne.bind(bookings);
      let acquisitions = 0;
      const gate = vi.spyOn(bookings, 'updateOne').mockImplementation(((
        filter: any,
        update: any,
        ...rest: any[]
      ) => {
        if (update.$set?.financialOperationToken && ++acquisitions === 2)
          attempted.release();
        return originalUpdate(filter, update, ...rest);
      }) as never);
      const recovery = abandon(String(row._id)).then((result) => result);
      let operation: Promise<any> | undefined;
      try {
        await reached.promise;
        operation = bookingOperation(kind).then(
          (result) => ({ result }),
          (error) => ({ error }),
        );
        await Promise.race([
          attempted.promise,
          operation.then(() => {
            throw new Error('Booking operation bypassed financial gate');
          }),
        ]);
        release.release();
        expect((await recovery).status).toBe(200);
        const outcome = await operation;
        if (kind === 'checkout') expect(outcome.error?.getStatus()).toBe(409);
        else expect(outcome.error).toBeUndefined();
        expect(
          (await model(ServiceOrder).findById(row._id).orFail()).reviewStatus,
        ).toBe('ABANDONED');
        expect(
          await model(Invoice).countDocuments({
            'charges.sourceId': String(row._id),
          }),
        ).toBe(0);
      } finally {
        release.release();
        await recovery;
        if (operation) await operation;
        gate.mockRestore();
        evidence.mockRestore();
      }
    },
  );

  it.each(['checkin', 'cancel', 'dates', 'checkout'])(
    'serializes actual %s admission before abandonment',
    async (kind) => {
      const row = await expired();
      await recoveryRoom();
      const acquired = signal();
      const release = signal();
      const attempted = signal();
      const bookings = model(Booking);
      const original = bookings.updateOne.bind(bookings);
      let acquisitions = 0;
      const gate = vi.spyOn(bookings, 'updateOne').mockImplementation((async (
        filter: any,
        update: any,
        ...rest: any[]
      ) => {
        if (update.$set?.financialOperationToken) {
          acquisitions++;
          if (acquisitions === 1) {
            const result = await original(filter, update, ...rest);
            acquired.release();
            await release.promise;
            return result;
          }
          attempted.release();
        }
        return original(filter, update, ...rest);
      }) as never);
      const operation = bookingOperation(kind).then(
        (result) => ({ result }),
        (error) => ({ error }),
      );
      let recovery: Promise<any> | undefined;
      try {
        await Promise.race([
          acquired.promise,
          operation.then(() => {
            throw new Error('Booking operation bypassed financial gate');
          }),
        ]);
        recovery = abandon(String(row._id)).then((result) => result);
        await attempted.promise;
        release.release();
        const outcome = await operation;
        if (kind === 'checkout') expect(outcome.error?.getStatus()).toBe(409);
        else expect(outcome.error).toBeUndefined();
        expect((await recovery).status).toBe(kind === 'checkout' ? 200 : 409);
        const current = await model(ServiceOrder).findById(row._id).orFail();
        expect(current.reviewStatus).toBe(
          kind === 'checkout' ? 'ABANDONED' : 'ACCEPTING',
        );
        if (kind !== 'checkout')
          expect(
            (await bookings.findById(bookingId).orFail())
              .acceptanceReservations,
          ).toContain(String(row._id));
      } finally {
        release.release();
        await operation;
        if (recovery) await recovery;
        gate.mockRestore();
      }
    },
  );

  it('rejects free confirmed acceptance outside a changed stay even while future', async () => {
    const row = await expired(0);
    await model(ServiceOrder).collection.updateOne(
      { _id: row._id },
      { $set: { requestedTime: new Date(Date.now() + 3 * 86400000) } },
    );
    await review(String(row._id)).expect(409);
    expect(
      (await model(ServiceOrder).findById(row._id).orFail()).reviewStatus,
    ).toBe('ACCEPTING');
    expect(
      (await model(Booking).findById(bookingId).orFail())
        .financialReconciliationOrderIds,
    ).toContain(String(row._id));
  });

  it('preserves markers when Task evidence lookup fails', async () => {
    const row = await expired();
    const lookup = vi
      .spyOn(model(Task), 'exists')
      .mockImplementationOnce(() => {
        throw new Error('Task evidence unavailable');
      });
    try {
      await abandon(String(row._id)).expect(409);
    } finally {
      lookup.mockRestore();
    }
    expect(
      (await model(ServiceOrder).findById(row._id).orFail()).reviewStatus,
    ).toBe('ACCEPTING');
    const booking = await model(Booking).findById(bookingId).orFail();
    expect(booking.acceptanceReservations).toContain(String(row._id));
    expect(booking.financialReconciliationOrderIds).toContain(String(row._id));
  });

  it('preserves markers when abandonment CAS matches no current intent', async () => {
    const row = await expired();
    const decision = vi
      .spyOn(model(ServiceOrder), 'findOneAndUpdate')
      .mockImplementationOnce((() => ({
        select: () => ({ exec: async () => null }),
      })) as never);
    try {
      await abandon(String(row._id)).expect(409);
    } finally {
      decision.mockRestore();
    }
    expect(
      (await model(ServiceOrder).findById(row._id).orFail()).reviewStatus,
    ).toBe('ACCEPTING');
    const booking = await model(Booking).findById(bookingId).orFail();
    expect(booking.acceptanceReservations).toContain(String(row._id));
    expect(booking.financialReconciliationOrderIds).toContain(String(row._id));
  });

  it.each([
    'amount',
    'type',
    'reason',
    'approved',
    'duplicate',
    'inactive',
    'wrongBooking',
  ])(
    'rejects inconsistent persisted charge %s without billing or marker cleanup',
    async (kind) => {
      const row = await expired();
      const source = {
        sourceId: String(row._id),
        type: 'SERVICE',
        amount: row.amount,
        reason: `Service order ${row._id}`,
        approved: true,
      };
      const charges = [
        {
          ...source,
          ...(kind === 'amount' ? { amount: row.amount + 1 } : {}),
          ...(kind === 'type' ? { type: 'OTHER' } : {}),
          ...(kind === 'reason' ? { reason: 'Different reason' } : {}),
          ...(kind === 'approved' ? { approved: false } : {}),
        },
      ];
      if (kind === 'duplicate') charges.push({ ...source });
      await model(Invoice).collection.insertOne({
        code: randomUUID(),
        booking:
          kind === 'wrongBooking'
            ? new Types.ObjectId()
            : new Types.ObjectId(bookingId),
        isActive: kind !== 'inactive',
        charges,
      });
      const invoices = app.get(InvoicesService);
      const charge = vi.spyOn(invoices, 'addCharge');
      try {
        await abandon(String(row._id)).expect(409);
        await review(String(row._id)).expect(409);
        expect(charge).not.toHaveBeenCalled();
      } finally {
        charge.mockRestore();
      }
      const booking = await model(Booking).findById(bookingId).orFail();
      expect(booking.acceptanceReservations).toContain(String(row._id));
      expect(booking.financialReconciliationOrderIds).toContain(
        String(row._id),
      );
      expect(
        (await model(ServiceOrder).findById(row._id).orFail()).reviewStatus,
      ).toBe('ACCEPTING');
      expect(await model(Task).countDocuments({ sourceId: row._id })).toBe(0);
    },
  );

  it('holds check-in compensation inside the gate before abandonment reads booking', async () => {
    const row = await expired();
    await recoveryRoom();
    const reached = signal();
    const release = signal();
    const attempted = signal();
    const rooms = model(Room);
    const originalRoomUpdate = rooms.updateOne.bind(rooms);
    const roomFailure = vi
      .spyOn(rooms, 'updateOne')
      .mockImplementationOnce((async () => {
        reached.release();
        await release.promise;
        return { modifiedCount: 0 };
      }) as never);
    const bookings = model(Booking);
    const original = bookings.updateOne.bind(bookings);
    let acquisitions = 0;
    const gate = vi.spyOn(bookings, 'updateOne').mockImplementation(((
      filter: any,
      update: any,
      ...rest: any[]
    ) => {
      if (update.$set?.financialOperationToken && ++acquisitions === 2)
        attempted.release();
      return original(filter, update, ...rest);
    }) as never);
    const operation = app
      .get(CheckInService)
      .checkIn(bookingId, {})
      .then(
        () => null,
        (error) => error,
      );
    let recovery: Promise<any> | undefined;
    try {
      await reached.promise;
      expect((await bookings.findById(bookingId).orFail()).status).toBe(
        'CHECKED_IN',
      );
      recovery = abandon(String(row._id)).then((response) => response);
      await attempted.promise;
      release.release();
      expect((await operation).getStatus()).toBe(409);
      expect((await recovery).status).toBe(200);
      expect((await bookings.findById(bookingId).orFail()).status).toBe(
        'CONFIRMED',
      );
    } finally {
      release.release();
      await operation;
      if (recovery) await recovery;
      roomFailure.mockRestore();
      gate.mockRestore();
    }
    expect(originalRoomUpdate).toBeDefined();
  });

  it('leaves stale financial ownership untouched', async () => {
    const row = await expired();
    await model(Booking).updateOne(
      { _id: bookingId },
      {
        $set: {
          financialOperationToken: 'old-owner',
          financialOperationStartedAt: new Date(0),
        },
      },
    );
    await abandon(String(row._id)).expect(409);
    const booking = await model(Booking)
      .findById(bookingId)
      .select('+financialOperationToken')
      .orFail();
    expect(booking.financialOperationToken).toBe('old-owner');
    expect(
      (await model(ServiceOrder).findById(row._id).orFail()).reviewStatus,
    ).toBe('ACCEPTING');
  });

  it('projects selected room and intake actor names on multi-room staff detail', async () => {
    const rooms = [new Types.ObjectId(), new Types.ObjectId()];
    await model(Booking)
      .db.collection('rooms')
      .insertMany(
        rooms.map((_id, index) => ({ _id, roomNumber: index ? '202' : '101' })),
      );
    await model(Booking).updateOne({ _id: bookingId }, { rooms });
    const created = await intake(
      input({
        roomId: String(rooms[1]),
        intakeMode: 'COMPLETED_ON_SITE',
        actualPerformerId: replacement,
        actualCompletedAt: new Date(Date.now() - 3600000).toISOString(),
        completionDetails: 'Delivered',
      }),
    ).expect(201);
    expect(created.body.roomNumber).toBe('202');
    expect(created.body.reportedByName).toBe('Reporter');
    expect(created.body.createdByName).toBe('Reporter');
    expect(created.body.actualPerformerName).toBe('Replacement');
    const detail = await http()
      .get(`/api/v1/service-orders/requests/${created.body.id}`)
      .set(reception)
      .expect(200);
    expect(detail.body.roomNumber).toBe('202');
  });

  it('enforces intake roles, room membership and authorized context/catalog contracts', async () => {
    await intake(input(), {
      'x-dev-role': 'CUSTOMER',
      'x-dev-user-id': reporter,
    }).expect(403);
    await intake(input({ roomId: String(new Types.ObjectId()) })).expect(400);
    await intake(input({ amount: 1 })).expect(400);
    const contexts = await http()
      .get('/api/v1/service-orders/intake/contexts')
      .set(staff())
      .expect(200);
    expect(
      contexts.body.items.find((row: { id: string }) => row.id === bookingId),
    ).toMatchObject({ guestName: 'Accountless Guest', status: 'CHECKED_IN' });
    await http()
      .get('/api/v1/service-orders/intake/catalog')
      .set(staff())
      .expect(200);
    await http()
      .get('/api/v1/service-orders/intake/contexts')
      .set({ 'x-dev-role': 'CUSTOMER', 'x-dev-user-id': reporter })
      .expect(403);
  });
});
