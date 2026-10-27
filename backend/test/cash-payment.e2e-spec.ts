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

describe('Record cash payment at the desk (e2e)', () => {
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

  /** Booking đang ở, tiền phòng 2.000.000, đã cọc `deposit` (mặc định 600.000). */
  const prepare = async (
    options: { status?: BookingStatus; deposit?: number } = {},
  ) => {
    const booking = await bookings.create({
      code: `CSH${tag}${++counter}`,
      guestName: 'Cash Guest',
      guestEmail: `csh-${tag}@example.test`,
      guestPhone: '0999999999',
      rooms: [roomId],
      checkIn: vn('2098-04-10'),
      checkOut: vn('2098-04-12'),
      guests: 2,
      status: options.status ?? BookingStatus.CheckedIn,
      roomTotal: 2000000,
      depositAmount: 600000,
      rateSnapshot: [{ room: roomId, ratePerNight: 1000000 }],
    });
    // GET tạo hoá đơn nếu chưa có.
    await http()
      .get(`/api/v1/bookings/${booking.id}/charges`)
      .set(RECEPTIONIST)
      .expect(200);
    const invoice = await invoices.findOne({ booking: booking._id });
    const deposit = options.deposit ?? 600000;
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
  const pay = (id: unknown, body: Record<string, unknown> = {}) =>
    http()
      .post(`/api/v1/bookings/${String(id)}/payments/cash`)
      .set(RECEPTIONIST)
      .send({ requestId: 'cash-12345678', ...body });
  const finalPayments = (id: unknown) =>
    payments
      .find({ booking: new Types.ObjectId(String(id)), purpose: 'FINAL' })
      .lean();

  const clean = async () => {
    const docs = await bookings
      .find({ code: new RegExp(`^CSH${tag}`) })
      .select('_id')
      .lean();
    const ids = docs.map((doc) => doc._id);
    await payments.deleteMany({ booking: { $in: ids } });
    await invoices.deleteMany({ booking: { $in: ids } });
    await bookings.deleteMany({ code: new RegExp(`^CSH${tag}`) });
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
      name: `CSH Deluxe ${typeId}`,
      adultCapacity: 2,
      childCapacity: 1,
      basePrice: 1000000,
    });
    await rooms.create({
      _id: roomId,
      roomNumber: `CS-${roomId}`,
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
    const { booking } = await prepare();
    await http()
      .post(`/api/v1/bookings/${booking.id}/payments/cash`)
      .set({
        'x-dev-role': 'CUSTOMER',
        'x-dev-user-id': String(new Types.ObjectId()),
      })
      .send({ requestId: 'cash-12345678' })
      .expect(403);
    await http()
      .post(`/api/v1/bookings/${booking.id}/payments/cash`)
      .send({ requestId: 'cash-12345678' })
      .expect(401);
  });

  it('records the balance due as a cash payment and settles the invoice', async () => {
    const { booking } = await prepare();
    const { body } = await pay(booking.id).expect(201);
    expect(body).toMatchObject({
      bookingId: String(booking.id),
      invoiceStatus: 'PAID',
      totals: {
        totalAmount: 2000000,
        depositPaid: 600000,
        finalPaid: 1400000,
        balanceDue: 0,
      },
    });
    const [saved] = await finalPayments(booking.id);
    expect(saved).toMatchObject({
      method: 'CASH',
      purpose: 'FINAL',
      status: 'SUCCESS',
      amount: 1400000,
    });
    expect(saved?.paidAt).toBeInstanceOf(Date);
    expect(saved?.providerTransactionRef).toBeUndefined();
  });

  it('charges the amount the server computes, including recorded extras', async () => {
    const { booking } = await prepare();
    await http()
      .post(`/api/v1/bookings/${booking.id}/charges`)
      .set(RECEPTIONIST)
      .send({ requestId: 'charge-12345678', amount: 100000, reason: 'Minibar' })
      .expect(201);
    const { body } = await pay(booking.id, { amount: 1 }).expect(400); // client không được gửi số tiền
    expect(body.message).toBeDefined();
    await pay(booking.id).expect(201);
    const [saved] = await finalPayments(booking.id);
    expect(saved?.amount).toBe(1500000);
  });

  it('does not record the same cash payment twice', async () => {
    const { booking } = await prepare();
    await pay(booking.id).expect(201);
    const { body } = await pay(booking.id).expect(201);
    expect(body.totals.balanceDue).toBe(0);
    expect(await finalPayments(booking.id)).toHaveLength(1);
  });

  it('refuses a request id that belongs to another booking', async () => {
    const first = await prepare();
    await pay(first.booking.id).expect(201);
    const second = await prepare();
    await pay(second.booking.id).expect(409);
    expect(await finalPayments(second.booking.id)).toHaveLength(0);
  });

  it('refuses a second payment once the final payment is settled', async () => {
    const { booking } = await prepare();
    await pay(booking.id).expect(201);
    await pay(booking.id, { requestId: 'cash-87654321' }).expect(409);
    expect(await finalPayments(booking.id)).toHaveLength(1);
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
      amount: 1400000,
    });
    const { body } = await pay(booking.id).expect(409);
    expect(body.message).toMatch(/pending/i);
  });

  it('refuses when nothing is left to pay', async () => {
    const { booking } = await prepare({ deposit: 2000000 });
    const { body } = await pay(booking.id).expect(409);
    expect(body.message).toMatch(/nothing/i);
    expect(await finalPayments(booking.id)).toHaveLength(0);
  });

  it('only takes cash for guests who are checked in', async () => {
    for (const status of [
      BookingStatus.PendingDeposit,
      BookingStatus.Confirmed,
      BookingStatus.CheckedOut,
      BookingStatus.Cancelled,
    ]) {
      const { booking } = await prepare({ status });
      await pay(booking.id).expect(409);
      expect(await finalPayments(booking.id)).toHaveLength(0);
    }
  });

  it('keeps only one payment when two are recorded at the same time', async () => {
    const { booking } = await prepare();
    const results = await Promise.all([
      pay(booking.id, { requestId: 'cash-aaaaaaaa' }),
      pay(booking.id, { requestId: 'cash-bbbbbbbb' }),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
    expect(await finalPayments(booking.id)).toHaveLength(1);
    const { body } = await http()
      .get(`/api/v1/bookings/${booking.id}/charges`)
      .set(RECEPTIONIST)
      .expect(200);
    expect(body.totals).toMatchObject({ finalPaid: 1400000, balanceDue: 0 });
  });

  it('validates the request', async () => {
    const { booking } = await prepare();
    await pay(booking.id, { requestId: 'short' }).expect(400);
    await pay(booking.id, { requestId: 'bad id with spaces' }).expect(400);
    await http()
      .post(`/api/v1/bookings/${booking.id}/payments/cash`)
      .set(RECEPTIONIST)
      .send({})
      .expect(400);
    await pay('not-an-id').expect(400);
    await pay(new Types.ObjectId()).expect(404);
  });
});
