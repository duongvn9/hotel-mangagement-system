import { VersioningType, type INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { Model, Types } from 'mongoose';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import {
  Booking,
  BookingStatus,
} from '../src/modules/bookings/schemas/booking.schema.js';
import { Invoice } from '../src/modules/invoices/schemas/invoice.schema.js';
import { PaymentTransaction } from '../src/modules/payments/schemas/payment-transaction.schema.js';
import { Room } from '../src/modules/rooms/schemas/room.schema.js';
import { RoomType } from '../src/modules/room-types/schemas/room-type.schema.js';

describe('Check out guest (e2e)', () => {
  let app: INestApplication;
  let bookings: Model<Booking>;
  let invoices: Model<Invoice>;
  let payments: Model<PaymentTransaction>;
  let rooms: Model<Room>;
  let roomTypes: Model<RoomType>;
  const tag = String(new Types.ObjectId()).slice(-8).toUpperCase();
  const typeId = new Types.ObjectId();
  const r1 = new Types.ObjectId();
  const r2 = new Types.ObjectId();
  const http = () => request(app.getHttpServer());
  const RECEPTIONIST = {
    'x-dev-role': 'RECEPTIONIST',
    'x-dev-user-id': String(new Types.ObjectId()),
  };
  const vn = (day: string) => new Date(`${day}T00:00:00.000+07:00`);
  let counter = 0;

  /** Booking đang ở phòng r1, tiền phòng 2.000.000, đã cọc `deposit` (mặc định 600.000). */
  const prepare = async (
    options: {
      status?: BookingStatus;
      deposit?: number;
      roomIds?: Types.ObjectId[];
    } = {},
  ) => {
    const roomIds = options.roomIds ?? [r1];
    const booking = await bookings.create({
      code: `OUT${tag}${++counter}`,
      guestName: 'Out Guest',
      guestEmail: `out-${tag}@example.test`,
      guestPhone: '0900000099',
      rooms: roomIds,
      checkIn: vn('2098-05-10'),
      checkOut: vn('2098-05-11'),
      adultCount: 2,
      childCount: 0,
      status: options.status ?? BookingStatus.CheckedIn,
      roomTotal: 1000000 * roomIds.length,
      depositAmount: 300000,
      rateSnapshot: roomIds.map((room) => ({ room, ratePerNight: 1000000 })),
    });
    await http()
      .get(`/api/v1/bookings/${booking.id}/charges`)
      .set(RECEPTIONIST)
      .expect(200);
    const invoice = await invoices.findOne({ booking: booking._id });
    const deposit = options.deposit ?? 300000;
    if (deposit > 0) {
      await payments.create({
        booking: booking._id,
        invoice: invoice?._id,
        transactionRef: `DEP-${tag}-${counter}`,
        providerTransactionRef: `VNP-${tag}-${counter}`,
        method: 'VNPAY',
        purpose: 'DEPOSIT',
        status: 'SUCCESS',
        amount: deposit,
        paidAt: new Date(),
      });
    }
    return { booking, invoice };
  };
  const payCash = (id: unknown) =>
    http()
      .post(`/api/v1/bookings/${String(id)}/payments/cash`)
      .set(RECEPTIONIST)
      .send({ requestId: `cash-${String(id)}` })
      .expect(201);
  const checkOut = (id: unknown) =>
    http()
      .post(`/api/v1/bookings/${String(id)}/check-out`)
      .set(RECEPTIONIST)
      .send();
  const roomStatus = async (id: Types.ObjectId) =>
    (await rooms.findById(id).lean())?.status;

  const clean = async () => {
    const docs = await bookings
      .find({ code: new RegExp(`^OUT${tag}`) })
      .select('_id')
      .lean();
    const ids = docs.map((doc) => doc._id);
    await payments.deleteMany({ booking: { $in: ids } });
    await invoices.deleteMany({ booking: { $in: ids } });
    await bookings.deleteMany({ code: new RegExp(`^OUT${tag}`) });
    await rooms.updateMany({ _id: r1 }, { $set: { status: 'OCCUPIED' } });
    await rooms.updateMany({ _id: r2 }, { $set: { status: 'MAINTENANCE' } });
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
      payments.init(),
      rooms.init(),
      roomTypes.init(),
    ]);
    await roomTypes.create({
      _id: typeId,
      name: `OUT Deluxe ${typeId}`,
      adultCapacity: 2,
      childCapacity: 1,
      basePrice: 1000000,
    });
    await rooms.create([
      {
        _id: r1,
        roomNumber: `OU-1-${tag}`,
        floor: 1,
        roomType: typeId,
        status: 'OCCUPIED',
      },
      {
        _id: r2,
        roomNumber: `OU-2-${tag}`,
        floor: 1,
        roomType: typeId,
        status: 'MAINTENANCE',
      },
    ]);
  });

  beforeEach(clean);

  afterAll(async () => {
    await clean();
    await rooms.deleteMany({ _id: { $in: [r1, r2] } });
    await roomTypes.deleteOne({ _id: typeId });
    await app.close();
  });

  it('rejects customers and anonymous callers', async () => {
    const { booking } = await prepare();
    await http()
      .post(`/api/v1/bookings/${booking.id}/check-out`)
      .set({
        'x-dev-role': 'CUSTOMER',
        'x-dev-user-id': String(new Types.ObjectId()),
      })
      .expect(403);
    await http().post(`/api/v1/bookings/${booking.id}/check-out`).expect(401);
  });

  it('checks out a guest whose invoice is paid and sends the room to cleaning', async () => {
    const { booking } = await prepare();
    await payCash(booking.id);
    const { body } = await checkOut(booking.id).expect(201);
    expect(body).toMatchObject({
      id: String(booking.id),
      code: booking.code,
      status: 'CHECKED_OUT',
      rooms: [
        { id: String(r1), roomNumber: `OU-1-${tag}`, status: 'CLEANING' },
      ],
      invoice: {
        invoiceStatus: 'PAID',
        totals: { totalAmount: 1000000, balanceDue: 0 },
      },
    });
    expect(new Date(body.checkedOutAt).getTime()).toBeGreaterThan(
      Date.now() - 60_000,
    );
    const saved = await bookings.findById(booking.id).lean();
    expect(saved?.status).toBe(BookingStatus.CheckedOut);
    expect(saved?.checkedOutAt).toBeDefined();
    expect(await roomStatus(r1)).toBe('CLEANING');
  });

  it('checks out straight away when the deposit already covers the invoice', async () => {
    const { booking } = await prepare({ deposit: 1000000 });
    await checkOut(booking.id).expect(201);
  });

  it('refuses while money is still due and changes nothing', async () => {
    const { booking } = await prepare();
    const { body } = await checkOut(booking.id).expect(409);
    expect(body.message).toMatch(/not fully paid/i);
    expect(body.message).toContain('700000');
    expect((await bookings.findById(booking.id).lean())?.status).toBe(
      BookingStatus.CheckedIn,
    );
    expect(await roomStatus(r1)).toBe('OCCUPIED');
  });

  it('refuses while a VNPay payment is still pending', async () => {
    const { booking, invoice } = await prepare();
    await payments.create({
      booking: booking._id,
      invoice: invoice?._id,
      transactionRef: `PEND-${tag}`,
      method: 'VNPAY',
      purpose: 'FINAL',
      status: 'PENDING',
      amount: 700000,
    });
    const { body } = await checkOut(booking.id).expect(409);
    expect(body.message).toMatch(/pending/i);
    expect(await roomStatus(r1)).toBe('OCCUPIED');
  });

  it('refuses guests who are not checked in', async () => {
    const cases: [BookingStatus, RegExp][] = [
      [BookingStatus.PendingDeposit, /not checked in/i],
      [BookingStatus.Confirmed, /not checked in/i],
      [BookingStatus.CheckedOut, /already/i],
      [BookingStatus.Cancelled, /cannot/i],
    ];
    for (const [status, message] of cases) {
      const { booking } = await prepare({ status });
      const { body } = await checkOut(booking.id).expect(409);
      expect(body.message).toMatch(message);
    }
    expect(await roomStatus(r1)).toBe('OCCUPIED');
  });

  it('leaves rooms that are not occupied untouched', async () => {
    const { booking } = await prepare({ roomIds: [r1, r2], deposit: 2000000 });
    const { body } = await checkOut(booking.id).expect(201);
    expect(body.rooms.map((room: { status: string }) => room.status)).toEqual([
      'CLEANING',
      'MAINTENANCE',
    ]);
    expect(await roomStatus(r1)).toBe('CLEANING');
    expect(await roomStatus(r2)).toBe('MAINTENANCE');
  });

  it('lets only one of two simultaneous check-outs through', async () => {
    const { booking } = await prepare({ deposit: 1000000 });
    const results = await Promise.all([
      checkOut(booking.id),
      checkOut(booking.id),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
    expect((await bookings.findById(booking.id).lean())?.status).toBe(
      BookingStatus.CheckedOut,
    );
    expect(await roomStatus(r1)).toBe('CLEANING');
  });

  it('closes the stay: no more charges or cash afterwards', async () => {
    const { booking } = await prepare({ deposit: 1000000 });
    await checkOut(booking.id).expect(201);
    await http()
      .post(`/api/v1/bookings/${booking.id}/charges`)
      .set(RECEPTIONIST)
      .send({ requestId: 'charge-12345678', amount: 1000, reason: 'Late' })
      .expect(409);
    await http()
      .post(`/api/v1/bookings/${booking.id}/payments/cash`)
      .set(RECEPTIONIST)
      .send({ requestId: 'cash-12345678' })
      .expect(409);
  });

  it('validates the booking id', async () => {
    await checkOut('not-an-id').expect(400);
    await checkOut(new Types.ObjectId()).expect(404);
  });
});
