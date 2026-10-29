import { VersioningType, type INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { Model, Types } from 'mongoose';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { Invoice } from '../src/modules/invoices/schemas/invoice.schema.js';
import { PaymentTransaction } from '../src/modules/payments/schemas/payment-transaction.schema.js';
import {
  Booking,
  BookingStatus,
} from '../src/modules/bookings/schemas/booking.schema.js';
import { Room } from '../src/modules/rooms/schemas/room.schema.js';
import { RoomType } from '../src/modules/room-types/schemas/room-type.schema.js';

describe('Record checkout additional charge (e2e)', () => {
  let app: INestApplication;
  let bookings: Model<Booking>;
  let invoices: Model<Invoice>;
  let payments: Model<PaymentTransaction>;
  let rooms: Model<Room>;
  let roomTypes: Model<RoomType>;
  const tag = String(new Types.ObjectId()).slice(-8).toUpperCase();
  const typeId = new Types.ObjectId();
  const roomId = new Types.ObjectId();
  const http = () => request(app.getHttpServer());
  const RECEPTIONIST = {
    'x-dev-role': 'RECEPTIONIST',
    'x-dev-user-id': String(new Types.ObjectId()),
  };
  const vn = (day: string) => new Date(`${day}T00:00:00.000+07:00`);
  let counter = 0;

  const seed = (status = BookingStatus.CheckedIn) =>
    bookings.create({
      code: `CHG${tag}${++counter}`,
      guestName: 'Charge Guest',
      guestEmail: `chg-${tag}@example.test`,
      guestPhone: '0988888888',
      rooms: [roomId],
      checkIn: vn('2098-03-10'),
      checkOut: vn('2098-03-12'),
      adultCount: 2,
      childCount: 0,
      status,
      roomTotal: 2000000,
      depositAmount: 600000,
      rateSnapshot: [{ room: roomId, ratePerNight: 1000000 }],
    });
  const add = (id: unknown, body: Record<string, unknown>) =>
    http()
      .post(`/api/v1/bookings/${String(id)}/charges`)
      .set(RECEPTIONIST)
      .send(body);
  const list = (id: unknown) =>
    http()
      .get(`/api/v1/bookings/${String(id)}/charges`)
      .set(RECEPTIONIST);
  const charge = (requestId: string, amount = 150000, reason = 'Minibar') => ({
    requestId,
    amount,
    reason,
  });

  const clean = async () => {
    const docs = await bookings
      .find({ code: new RegExp(`^CHG${tag}`) })
      .select('_id')
      .lean();
    await payments.deleteMany({ booking: { $in: docs.map((d) => d._id) } });
    await invoices.deleteMany({ booking: { $in: docs.map((d) => d._id) } });
    await bookings.deleteMany({ code: new RegExp(`^CHG${tag}`) });
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    await app.init();
    bookings = app.get(getModelToken(Booking.name));
    invoices = app.get(getModelToken(Invoice.name));
    payments = app.get(getModelToken(PaymentTransaction.name));
    rooms = app.get(getModelToken(Room.name));
    roomTypes = app.get(getModelToken(RoomType.name));
    await Promise.all([
      bookings.init(),
      invoices.init(),
      rooms.init(),
      roomTypes.init(),
    ]);
    await roomTypes.create({
      _id: typeId,
      name: `CHG Deluxe ${typeId}`,
      adultCapacity: 2,
      childCapacity: 1,
      basePrice: 1000000,
    });
    await rooms.create({
      _id: roomId,
      roomNumber: `CH-${roomId}`,
      floor: 1,
      roomType: typeId,
      status: 'OCCUPIED',
    });
  });

  beforeEach(clean);

  afterAll(async () => {
    await clean();
    await rooms.deleteOne({ _id: roomId });
    await roomTypes.deleteOne({ _id: typeId });
    await app.close();
  });

  it('rejects customers and anonymous callers', async () => {
    const booking = await seed();
    for (const method of ['post', 'get'] as const) {
      await http()
        [method](`/api/v1/bookings/${booking.id}/charges`)
        .set({
          'x-dev-role': 'CUSTOMER',
          'x-dev-user-id': String(new Types.ObjectId()),
        })
        .send(charge('req-12345678'))
        .expect(403);
      await http()
        [method](`/api/v1/bookings/${booking.id}/charges`)
        .send(charge('req-12345678'))
        .expect(401);
    }
  });

  it('records a charge and updates the invoice totals', async () => {
    const booking = await seed();
    const { body } = await add(booking.id, charge('req-12345678')).expect(201);
    expect(body).toMatchObject({
      bookingId: String(booking.id),
      code: booking.code,
      status: 'CHECKED_IN',
      totals: {
        roomTotal: 2000000,
        additionalTotal: 150000,
        totalAmount: 2150000,
        depositPaid: 0,
        balanceDue: 2150000,
      },
    });
    expect(body.charges).toEqual([
      expect.objectContaining({
        type: 'ADDITIONAL',
        amount: 150000,
        reason: 'Minibar',
      }),
    ]);
    const again = await list(booking.id).expect(200);
    expect(again.body.totals.additionalTotal).toBe(150000);
    expect(again.body.charges).toHaveLength(1);
  });

  it('trims the reason and keeps separate charges separate', async () => {
    const booking = await seed();
    await add(booking.id, charge('req-aaaaaaaa', 100000, '  Giặt ủi  ')).expect(
      201,
    );
    const { body } = await add(
      booking.id,
      charge('req-bbbbbbbb', 50000, 'Đền bù khăn'),
    ).expect(201);
    expect(body.totals).toMatchObject({
      additionalTotal: 150000,
      totalAmount: 2150000,
    });
    expect(body.charges.map((item: { reason: string }) => item.reason)).toEqual(
      ['Giặt ủi', 'Đền bù khăn'],
    );
  });

  it('does not double charge when the same request is sent twice', async () => {
    const booking = await seed();
    await add(booking.id, charge('req-12345678')).expect(201);
    const { body } = await add(booking.id, charge('req-12345678')).expect(201);
    expect(body.charges).toHaveLength(1);
    expect(body.totals.additionalTotal).toBe(150000);
  });

  it('refuses to reuse a request id with different content', async () => {
    const booking = await seed();
    await add(booking.id, charge('req-12345678')).expect(201);
    await add(booking.id, charge('req-12345678', 999000)).expect(409);
    const { body } = await list(booking.id).expect(200);
    expect(body.totals.additionalTotal).toBe(150000);
  });

  it('keeps both charges when two are recorded at the same time', async () => {
    const booking = await seed();
    const results = await Promise.all([
      add(booking.id, charge('req-aaaaaaaa', 100000, 'Một')),
      add(booking.id, charge('req-bbbbbbbb', 50000, 'Hai')),
    ]);
    expect(results.map((result) => result.status)).toEqual([201, 201]);
    const { body } = await list(booking.id).expect(200);
    expect(body.charges).toHaveLength(2);
    expect(body.totals.additionalTotal).toBe(150000);
  });

  it('only records charges for guests who are checked in', async () => {
    for (const status of [
      BookingStatus.PendingDeposit,
      BookingStatus.Confirmed,
      BookingStatus.CheckedOut,
      BookingStatus.Cancelled,
    ]) {
      const booking = await seed(status);
      await add(booking.id, charge('req-12345678')).expect(409);
      expect(await invoices.countDocuments({ booking: booking._id })).toBe(0);
    }
  });

  it('allows new charges after a final payment while still checked in', async () => {
    const booking = await seed();
    await add(booking.id, charge('req-12345678')).expect(201);
    const invoice = await invoices.findOne({ booking: booking._id });
    await payments.create({
      booking: booking._id,
      invoice: invoice?._id,
      transactionRef: `CASH-${tag}`,
      method: 'CASH',
      purpose: 'FINAL',
      status: 'SUCCESS',
      amount: 2150000,
      paidAt: new Date(),
    });
    const { body } = await add(booking.id, charge('req-87654321')).expect(201);
    expect(body.totals.balanceDue).toBe(150000);
    const again = await list(booking.id).expect(200);
    expect(again.body.charges).toHaveLength(2);
  });

  it('validates the charge', async () => {
    const booking = await seed();
    const bad: Record<string, unknown>[] = [
      charge('req-12345678', 0),
      charge('req-12345678', -5),
      charge('req-12345678', 1.5),
      charge('req-12345678', 100_000_001),
      { ...charge('req-12345678'), amount: '150000' },
      charge('req-12345678', 150000, ''),
      charge('req-12345678', 150000, '   '),
      charge('req-12345678', 150000, 'x'.repeat(201)),
      { amount: 150000, reason: 'Minibar' },
      charge('short'),
      charge('bad id with spaces'),
      { ...charge('req-12345678'), extra: true },
    ];
    for (const body of bad) {
      await add(booking.id, body).expect(400);
    }
    await add('not-an-id', charge('req-12345678')).expect(400);
    await add(new Types.ObjectId(), charge('req-12345678')).expect(404);
  });

  it('lists an empty charge list and validates the booking id', async () => {
    const booking = await seed();
    const { body } = await list(booking.id).expect(200);
    expect(body.charges).toEqual([]);
    expect(body.totals).toMatchObject({
      roomTotal: 2000000,
      additionalTotal: 0,
      totalAmount: 2000000,
    });
    await list('not-an-id').expect(400);
    await list(new Types.ObjectId()).expect(404);
  });
});
