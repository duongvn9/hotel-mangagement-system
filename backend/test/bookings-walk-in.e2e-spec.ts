import { VersioningType, type INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { Model, Types } from 'mongoose';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { Booking } from '../src/modules/bookings/schemas/booking.schema.js';
import { Invoice } from '../src/modules/invoices/schemas/invoice.schema.js';
import { PaymentTransaction } from '../src/modules/payments/schemas/payment-transaction.schema.js';
import { RoomHold } from '../src/modules/bookings/schemas/room-hold.schema.js';
import { Room } from '../src/modules/rooms/schemas/room.schema.js';
import { RoomType } from '../src/modules/room-types/schemas/room-type.schema.js';

describe('Create booking for walk-in guest (e2e)', () => {
  let app: INestApplication;
  let bookings: Model<Booking>;
  let holds: Model<RoomHold>;
  let invoices: Model<Invoice>;
  let payments: Model<PaymentTransaction>;
  let rooms: Model<Room>;
  let roomTypes: Model<RoomType>;
  const typeId = new Types.ObjectId();
  const roomA = new Types.ObjectId();
  const roomB = new Types.ObjectId();
  const receptionistId = new Types.ObjectId();
  const http = () => request(app.getHttpServer());
  const RECEPTIONIST = {
    'x-dev-role': 'RECEPTIONIST',
    'x-dev-user-id': String(receptionistId),
  };
  const guest = {
    guestName: 'Walk In',
    guestEmail: 'walkin@example.test',
    guestPhone: '0911111111',
  };

  const body = (
    roomIds: Types.ObjectId[],
    checkIn: string,
    checkOut: string,
    adultCount = 2,
  ) => ({
    rooms: roomIds.map(String),
    checkIn,
    checkOut,
    adultCount,
    ...guest,
  });

  const clean = async () => {
    const roomList = [roomA, roomB];
    const docs = await bookings
      .find({ rooms: { $in: roomList } })
      .select('_id')
      .lean();
    const ids = docs.map((d) => d._id);
    await holds.deleteMany({ booking: { $in: ids } });
    await payments.deleteMany({ booking: { $in: ids } });
    await invoices.deleteMany({ booking: { $in: ids } });
    await bookings.deleteMany({ rooms: { $in: roomList } });
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
    holds = app.get(getModelToken(RoomHold.name));
    invoices = app.get(getModelToken(Invoice.name));
    payments = app.get(getModelToken(PaymentTransaction.name));
    rooms = app.get(getModelToken(Room.name));
    roomTypes = app.get(getModelToken(RoomType.name));
    await Promise.all([
      bookings.init(),
      holds.init(),
      rooms.init(),
      roomTypes.init(),
    ]);
    await roomTypes.create({
      _id: typeId,
      name: `WALKIN Deluxe ${typeId}`,
      adultCapacity: 2,
      childCapacity: 1,
      basePrice: 1000000,
    });
    await rooms.create([
      {
        _id: roomA,
        roomNumber: `WI-A-${roomA}`,
        floor: 1,
        roomType: typeId,
        status: 'AVAILABLE',
      },
      {
        _id: roomB,
        roomNumber: `WI-B-${roomB}`,
        floor: 1,
        roomType: typeId,
        status: 'AVAILABLE',
      },
    ]);
  });

  beforeEach(clean);

  afterAll(async () => {
    await clean();
    await rooms.deleteMany({ _id: { $in: [roomA, roomB] } });
    await roomTypes.deleteOne({ _id: typeId });
    await app.close();
  });

  it('lets a receptionist create a confirmed booking with no customer and no hold', async () => {
    const response = await http()
      .post('/api/v1/bookings/walk-in')
      .set(RECEPTIONIST)
      .send(body([roomA], '2092-01-10', '2092-01-12'))
      .expect(201);
    expect(response.body).toMatchObject({
      status: 'CONFIRMED',
      roomTotal: 2000000, // 1 phòng x 2 đêm x 1.000.000
      depositAmount: 200000, // 10% tiền phòng, để thu cọc tại quầy
      adultCount: 2,
    });
    expect(response.body.code).toMatch(/^BK/);
    const saved = await bookings.findById(response.body.id).lean();
    expect(saved?.customer).toBeUndefined();
    expect(String(saved?.createdBy)).toBe(String(receptionistId));
    expect(saved?.rateSnapshot[0]).toMatchObject({ ratePerNight: 1000000 });
    expect(
      await holds.countDocuments({
        booking: new Types.ObjectId(response.body.id),
      }),
    ).toBe(0);
  });

  describe('desk deposit', () => {
    const create = async (checkIn: string, checkOut: string) =>
      (
        await http()
          .post('/api/v1/bookings/walk-in')
          .set(RECEPTIONIST)
          .send(body([roomA], checkIn, checkOut))
          .expect(201)
      ).body as { id: string; depositAmount: number };
    const deposit = (id: string, payload: object) =>
      http()
        .post(`/api/v1/bookings/${id}/payments/deposit`)
        .set(RECEPTIONIST)
        .send(payload);

    it('records the booking deposit and shows it on the invoice', async () => {
      const booking = await create('2092-03-10', '2092-03-12');

      const response = await deposit(booking.id, {
        method: 'CASH',
        requestId: 'dep-12345678',
      }).expect(201);

      expect(response.body.totals).toMatchObject({
        depositPaid: booking.depositAmount,
        balanceDue: 2000000 - booking.depositAmount,
      });
      const saved = await payments.find({
        booking: new Types.ObjectId(booking.id),
      });
      expect(saved).toHaveLength(1);
      expect(saved[0]).toMatchObject({
        method: 'CASH',
        purpose: 'DEPOSIT',
        status: 'SUCCESS',
        amount: booking.depositAmount,
      });
    });

    it('is idempotent per request id and refuses a second deposit', async () => {
      const booking = await create('2092-04-10', '2092-04-12');
      const payload = { method: 'CARD', requestId: 'dep-87654321' };

      await deposit(booking.id, payload).expect(201);
      await deposit(booking.id, payload).expect(201);
      const second = await deposit(booking.id, {
        method: 'CASH',
        requestId: 'dep-other-123',
      }).expect(409);

      expect(second.body.message).toMatch(/already been paid/);
      expect(
        await payments.countDocuments({
          booking: new Types.ObjectId(booking.id),
        }),
      ).toBe(1);
    });

    it('validates the body and who may call it', async () => {
      const booking = await create('2092-05-10', '2092-05-12');

      await deposit(booking.id, {
        method: 'VNPAY',
        requestId: 'dep-12345678',
      }).expect(400);
      await deposit(booking.id, { method: 'CASH', requestId: 'x' }).expect(400);
      await http()
        .post(`/api/v1/bookings/${booking.id}/payments/deposit`)
        .set({
          'x-dev-role': 'CUSTOMER',
          'x-dev-user-id': String(new Types.ObjectId()),
        })
        .send({ method: 'CASH', requestId: 'dep-12345678' })
        .expect(403);
    });
  });

  it('lets a manager create a walk-in booking', async () => {
    await http()
      .post('/api/v1/bookings/walk-in')
      .set({
        'x-dev-role': 'MANAGER',
        'x-dev-user-id': String(new Types.ObjectId()),
      })
      .send(body([roomA], '2092-02-10', '2092-02-12'))
      .expect(201);
  });

  it('rejects customers and anonymous callers', async () => {
    await http()
      .post('/api/v1/bookings/walk-in')
      .set({
        'x-dev-role': 'CUSTOMER',
        'x-dev-user-id': String(new Types.ObjectId()),
      })
      .send(body([roomA], '2092-01-10', '2092-01-12'))
      .expect(403);
    await http()
      .post('/api/v1/bookings/walk-in')
      .send(body([roomA], '2092-01-10', '2092-01-12'))
      .expect(401);
  });

  it('blocks the room for later searches and rejects an overlapping walk-in', async () => {
    await http()
      .post('/api/v1/bookings/walk-in')
      .set(RECEPTIONIST)
      .send(body([roomA], '2092-03-10', '2092-03-13'))
      .expect(201);
    await http()
      .post('/api/v1/bookings/walk-in')
      .set(RECEPTIONIST)
      .send(body([roomA], '2092-03-12', '2092-03-14'))
      .expect(409);
    // Cùng khoảng ngày nhưng phòng khác vẫn đặt được.
    await http()
      .post('/api/v1/bookings/walk-in')
      .set(RECEPTIONIST)
      .send(body([roomB], '2092-03-12', '2092-03-14'))
      .expect(201);
  });

  it('rejects an online booking overlapping a confirmed walk-in', async () => {
    await http()
      .post('/api/v1/bookings/walk-in')
      .set(RECEPTIONIST)
      .send(body([roomA], '2092-04-10', '2092-04-12'))
      .expect(201);
    await http()
      .post('/api/v1/bookings')
      .send(body([roomA], '2092-04-11', '2092-04-13'))
      .expect(409);
  });

  it('validates party size against room capacity', async () => {
    await http()
      .post('/api/v1/bookings/walk-in')
      .set(RECEPTIONIST)
      .send(body([roomA], '2092-05-10', '2092-05-12', 10))
      .expect(400);
  });
});
