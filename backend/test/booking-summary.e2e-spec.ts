import { VersioningType, type INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { type Model, Types } from 'mongoose';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import {
  Booking,
  BookingSource,
  BookingStatus,
} from '../src/modules/bookings/schemas/booking.schema.js';
import { Invoice } from '../src/modules/invoices/schemas/invoice.schema.js';
import {
  PaymentMethod,
  PaymentPurpose,
  PaymentStatus,
  PaymentTransaction,
} from '../src/modules/payments/schemas/payment-transaction.schema.js';
import { Room } from '../src/modules/rooms/schemas/room.schema.js';
import { RoomType } from '../src/modules/room-types/schemas/room-type.schema.js';
import { ServiceOrder } from '../src/modules/service-orders/schemas/service-order.schema.js';

describe('GET /bookings/:id/summary (e2e)', () => {
  let app: INestApplication;
  let bookings: Model<Booking>;
  let payments: Model<PaymentTransaction>;
  let invoices: Model<Invoice>;
  let serviceOrders: Model<ServiceOrder>;
  let rooms: Model<Room>;
  let roomTypes: Model<RoomType>;
  const tag = String(new Types.ObjectId()).slice(-8).toUpperCase();
  const owner = new Types.ObjectId();
  const stranger = new Types.ObjectId();
  const typeId = new Types.ObjectId();
  const roomId = new Types.ObjectId();
  const code = `SUM${tag}`;
  let bookingId = '';
  let guestBookingId = '';
  const guestCode = `SUMG${tag}`;
  const http = () => request(app.getHttpServer());
  const as = (role: string, id: Types.ObjectId) => ({
    'x-dev-role': role,
    'x-dev-user-id': String(id),
  });

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    await app.init();
    bookings = app.get(getModelToken(Booking.name));
    payments = app.get(getModelToken(PaymentTransaction.name));
    invoices = app.get(getModelToken(Invoice.name));
    serviceOrders = app.get(getModelToken(ServiceOrder.name));
    rooms = app.get(getModelToken(Room.name));
    roomTypes = app.get(getModelToken(RoomType.name));
    await roomTypes.create({
      _id: typeId,
      name: `Summary Deluxe ${tag}`,
      adultCapacity: 2,
      childCapacity: 1,
      basePrice: 1000000,
    });
    await rooms.create({
      _id: roomId,
      roomNumber: `S${tag}`,
      floor: 1,
      roomType: typeId,
    });
    const booking = await bookings.create({
      customer: owner,
      code,
      rooms: [roomId],
      guestName: 'Summary Guest',
      guestEmail: 'summary@example.test',
      guestPhone: '0900000009',
      checkIn: new Date('2098-05-10T00:00:00.000Z'),
      checkOut: new Date('2098-05-12T00:00:00.000Z'),
      adultCount: 2,
      childCount: 1,
      roomTotal: 2000000,
      depositAmount: 200000,
      source: BookingSource.Online,
      status: BookingStatus.Confirmed,
      rateSnapshot: [{ room: roomId, ratePerNight: 1000000 }],
    });
    bookingId = String(booking._id);
    const guestBooking = await bookings.create({
      code: guestCode,
      rooms: [roomId],
      guestName: 'Walk-in Guest',
      guestEmail: 'walkin@example.test',
      guestPhone: '0900000008',
      checkIn: new Date('2098-06-10T00:00:00.000Z'),
      checkOut: new Date('2098-06-12T00:00:00.000Z'),
      adultCount: 2,
      roomTotal: 2000000,
      depositAmount: 200000,
      source: BookingSource.FrontDesk,
      status: BookingStatus.Confirmed,
      rateSnapshot: [{ room: roomId, ratePerNight: 1000000 }],
    });
    guestBookingId = String(guestBooking._id);
    const invoice = await invoices.create({
      booking: booking._id,
      code: `INV-${booking._id}`,
      charges: [],
    });
    await payments.create([
      {
        booking: booking._id,
        invoice: invoice._id,
        transactionRef: `SUM-${tag}-1`,
        method: PaymentMethod.Cash,
        purpose: PaymentPurpose.Deposit,
        status: PaymentStatus.Success,
        amount: 200000,
        paidAt: new Date('2098-05-01T03:00:00.000Z'),
      },
      {
        booking: booking._id,
        invoice: invoice._id,
        transactionRef: `SUM-${tag}-2`,
        method: PaymentMethod.Vnpay,
        purpose: PaymentPurpose.Final,
        status: PaymentStatus.Cancelled,
        amount: 1800000,
        isActive: false,
      },
    ]);
    await serviceOrders.create({
      customer: owner,
      booking: booking._id,
      service: new Types.ObjectId(),
      serviceName: 'Giặt ủi',
      unit: 'bộ',
      quantity: 2,
      unitPriceVND: 75000,
      amount: 150000,
      requestedTime: new Date('2098-05-10T09:00:00.000Z'),
    });
  }, 30000);

  afterAll(async () => {
    const ids = [bookingId, guestBookingId]
      .filter(Boolean)
      .map((id) => new Types.ObjectId(id));
    if (ids.length > 0) {
      await Promise.all([
        payments.deleteMany({ booking: { $in: ids } }),
        invoices.deleteMany({ booking: { $in: ids } }),
        serviceOrders.deleteMany({ booking: { $in: ids } }),
        bookings.deleteMany({ _id: { $in: ids } }),
      ]);
    }
    await Promise.all([
      rooms?.deleteOne({ _id: roomId }),
      roomTypes?.deleteOne({ _id: typeId }),
    ]);
    await app?.close();
  });

  const get = (headers: Record<string, string> = {}, query = '') =>
    http().get(`/api/v1/bookings/${bookingId}/summary${query}`).set(headers);

  it('gives the owner the stay, guest, room, invoice, payments and service orders', async () => {
    const { body } = await get(as('CUSTOMER', owner)).expect(200);

    expect(body).toMatchObject({
      bookingId,
      code,
      status: 'CONFIRMED',
      source: 'ONLINE',
      adultCount: 2,
      childCount: 1,
      depositAmount: 200000,
      guest: {
        name: 'Summary Guest',
        email: 'summary@example.test',
        phone: '0900000009',
      },
      rooms: [{ roomNumber: `S${tag}`, roomTypeName: `Summary Deluxe ${tag}` }],
      invoice: { roomTotal: 2000000 },
    });
    expect(body.payments).toEqual([
      expect.objectContaining({
        method: 'CASH',
        purpose: 'DEPOSIT',
        status: 'SUCCESS',
        amount: 200000,
        date: '2098-05-01T03:00:00.000Z',
      }),
    ]);
    expect(body.serviceOrders).toEqual([
      expect.objectContaining({
        serviceName: 'Giặt ủi',
        quantity: 2,
        amount: 150000,
        status: 'PENDING',
      }),
    ]);
  });

  it('lets staff read it, and a guest read their own booking with the code', async () => {
    await get(as('RECEPTIONIST', new Types.ObjectId())).expect(200);
    await get(as('MANAGER', new Types.ObjectId())).expect(200);
    await http()
      .get(`/api/v1/bookings/${guestBookingId}/summary?code=${guestCode}`)
      .expect(200);
  });

  it('refuses another customer, a wrong code and a caller with no code', async () => {
    await get(as('CUSTOMER', stranger)).expect(403);
    await http()
      .get(`/api/v1/bookings/${guestBookingId}/summary?code=WRONG`)
      .expect(403);
    await http().get(`/api/v1/bookings/${guestBookingId}/summary`).expect(401);
    // Booking của khách đã đăng nhập không đọc được chỉ bằng mã.
    await get({}, `?code=${code}`).expect(401);
  });

  it('rejects a malformed id and reports an unknown booking', async () => {
    await http()
      .get('/api/v1/bookings/not-an-id/summary')
      .set(as('RECEPTIONIST', new Types.ObjectId()))
      .expect(400);
    await http()
      .get(`/api/v1/bookings/${new Types.ObjectId()}/summary`)
      .set(as('RECEPTIONIST', new Types.ObjectId()))
      .expect(404);
  });
});
