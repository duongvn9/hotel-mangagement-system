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
import { RoomHold } from '../src/modules/bookings/schemas/room-hold.schema.js';
import { Room } from '../src/modules/rooms/schemas/room.schema.js';
import { RoomType } from '../src/modules/room-types/schemas/room-type.schema.js';

describe('Update booking (e2e)', () => {
  let app: INestApplication;
  let bookings: Model<Booking>;
  let holds: Model<RoomHold>;
  let rooms: Model<Room>;
  let roomTypes: Model<RoomType>;
  const typeStd = new Types.ObjectId();
  const typePremium = new Types.ObjectId();
  const roomA = new Types.ObjectId();
  const roomB = new Types.ObjectId();
  const roomP = new Types.ObjectId();
  const receptionistId = new Types.ObjectId();
  const http = () => request(app.getHttpServer());
  const RECEPTIONIST = {
    'x-dev-role': 'RECEPTIONIST',
    'x-dev-user-id': String(receptionistId),
  };
  const guest = {
    guestName: 'Update Guest',
    guestEmail: 'update@example.test',
    guestPhone: '0933333333',
  };
  const stay = (
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
  const walkIn = async (
    roomIds: Types.ObjectId[],
    checkIn: string,
    checkOut: string,
  ) =>
    (
      await http()
        .post('/api/v1/bookings/walk-in')
        .set(RECEPTIONIST)
        .send(stay(roomIds, checkIn, checkOut))
        .expect(201)
    ).body as { id: string; code: string };
  const online = async (
    roomIds: Types.ObjectId[],
    checkIn: string,
    checkOut: string,
  ) =>
    (
      await http()
        .post('/api/v1/bookings')
        .send(stay(roomIds, checkIn, checkOut))
        .expect(201)
    ).body as { id: string };
  const patch = (id: string, body: Record<string, unknown>) =>
    http().patch(`/api/v1/bookings/${id}`).set(RECEPTIONIST).send(body);

  const clean = async () => {
    const roomList = [roomA, roomB, roomP];
    const docs = await bookings
      .find({ rooms: { $in: roomList } })
      .select('_id')
      .lean();
    await holds.deleteMany({ booking: { $in: docs.map((d) => d._id) } });
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
    rooms = app.get(getModelToken(Room.name));
    roomTypes = app.get(getModelToken(RoomType.name));
    await Promise.all([
      bookings.init(),
      holds.init(),
      rooms.init(),
      roomTypes.init(),
    ]);
    await roomTypes.create([
      {
        _id: typeStd,
        name: `UPD Std ${typeStd}`,
        adultCapacity: 2,
        childCapacity: 1,
        basePrice: 1000000,
      },
      {
        _id: typePremium,
        name: `UPD Premium ${typePremium}`,
        adultCapacity: 2,
        childCapacity: 1,
        basePrice: 2000000,
      },
    ]);
    await rooms.create([
      {
        _id: roomA,
        roomNumber: `UP-A-${roomA}`,
        floor: 1,
        roomType: typeStd,
        status: 'AVAILABLE',
      },
      {
        _id: roomB,
        roomNumber: `UP-B-${roomB}`,
        floor: 1,
        roomType: typeStd,
        status: 'AVAILABLE',
      },
      {
        _id: roomP,
        roomNumber: `UP-P-${roomP}`,
        floor: 2,
        roomType: typePremium,
        status: 'AVAILABLE',
      },
    ]);
  });

  beforeEach(clean);

  afterAll(async () => {
    await clean();
    await rooms.deleteMany({ _id: { $in: [roomA, roomB, roomP] } });
    await roomTypes.deleteMany({ _id: { $in: [typeStd, typePremium] } });
    await app.close();
  });

  it('rejects customers and anonymous callers', async () => {
    const created = await walkIn([roomA], '2094-01-10', '2094-01-12');
    await http()
      .patch(`/api/v1/bookings/${created.id}`)
      .set({
        'x-dev-role': 'CUSTOMER',
        'x-dev-user-id': String(new Types.ObjectId()),
      })
      .send({ adultCount: 1 })
      .expect(403);
    await http()
      .patch(`/api/v1/bookings/${created.id}`)
      .send({ adultCount: 1 })
      .expect(401);
  });

  it('extends a confirmed stay over its own dates, reprices and keeps the deposit', async () => {
    const created = await walkIn([roomA], '2094-01-10', '2094-01-12');
    const before = await bookings.findById(created.id).lean();
    const { body } = await patch(created.id, {
      checkOut: '2094-01-13',
    }).expect(200);
    expect(body).toMatchObject({
      id: created.id,
      status: 'CONFIRMED',
      roomTotal: 3000000, // 1 phòng x 3 đêm x 1.000.000
      depositAmount: before?.depositAmount,
    });
    const saved = await bookings.findById(created.id).lean();
    expect(saved?.checkOut.toISOString()).toBe('2094-01-12T17:00:00.000Z');
    expect(saved?.rateSnapshot).toHaveLength(1);
  });

  it('moves a booking to a room with a different rate', async () => {
    const created = await walkIn([roomA], '2094-02-10', '2094-02-12');
    const { body } = await patch(created.id, { rooms: [String(roomP)] }).expect(
      200,
    );
    expect(body.roomTotal).toBe(4000000); // 2 đêm x 2.000.000
    const saved = await bookings.findById(created.id).lean();
    expect(saved?.rooms.map(String)).toEqual([String(roomP)]);
    expect(saved?.rateSnapshot[0]).toMatchObject({ ratePerNight: 2000000 });
    // Phòng cũ được nhả: đặt lại được ngay.
    await walkIn([roomA], '2094-02-10', '2094-02-12');
  });

  it('rejects a move onto a taken room and leaves the booking untouched', async () => {
    await walkIn([roomB], '2094-03-10', '2094-03-13');
    const created = await walkIn([roomA], '2094-03-11', '2094-03-12');
    await patch(created.id, { rooms: [String(roomB)] }).expect(409);
    const saved = await bookings.findById(created.id).lean();
    expect(saved?.rooms.map(String)).toEqual([String(roomA)]);
    expect(saved?.roomTotal).toBe(1000000);
  });

  it('rejects a stay that overlaps another booking on the same room', async () => {
    await walkIn([roomA], '2094-04-14', '2094-04-16');
    const created = await walkIn([roomA], '2094-04-10', '2094-04-12');
    await patch(created.id, { checkOut: '2094-04-15' }).expect(409);
  });

  it('updates the hold and recalculates the deposit of a pending booking', async () => {
    const created = await online([roomA], '2094-05-10', '2094-05-12');
    const before = await holds
      .findOne({ booking: new Types.ObjectId(created.id) })
      .lean();
    const { body } = await patch(created.id, {
      rooms: [String(roomP)],
      checkOut: '2094-05-13',
    }).expect(200);
    expect(body).toMatchObject({
      status: 'PENDING_DEPOSIT',
      roomTotal: 6000000, // 3 đêm x 2.000.000
      depositAmount: 1800000, // cọc 30%
    });
    const hold = await holds
      .findOne({ booking: new Types.ObjectId(created.id) })
      .lean();
    expect(hold?.rooms.map(String)).toEqual([String(roomP)]);
    expect(hold?.checkOut.toISOString()).toBe('2094-05-12T17:00:00.000Z');
    expect(hold?.expiresAt.getTime()).toBe(before?.expiresAt.getTime());
    // Phòng mới đang được giữ, người khác không đặt được.
    await http()
      .post('/api/v1/bookings')
      .send(stay([roomP], '2094-05-11', '2094-05-12'))
      .expect(409);
  });

  it('updates child occupancy independently and preserves adults and hold deadline', async () => {
    const created = await online([roomA], '2094-05-10', '2094-05-12');
    const before = await holds
      .findOne({ booking: new Types.ObjectId(created.id) })
      .lean();
    const { body } = await patch(created.id, { childCount: 1 }).expect(200);
    expect(body).toMatchObject({
      adultCount: 2,
      childCount: 1,
      source: 'ONLINE',
    });
    expect(body).not.toHaveProperty('guests');
    const after = await holds
      .findOne({ booking: new Types.ObjectId(created.id) })
      .lean();
    expect(after?.expiresAt).toEqual(before?.expiresAt);
    await patch(created.id, { childCount: 2 }).expect(400);
  });

  it('rejects contact and stay edits after the pending hold expires', async () => {
    const created = await online([roomA], '2094-05-10', '2094-05-12');
    await holds.updateOne(
      { booking: new Types.ObjectId(created.id) },
      { $set: { expiresAt: new Date(0) } },
    );
    await patch(created.id, { guestName: 'Too late' }).expect(409);
    expect((await bookings.findById(created.id).lean())?.status).toBe(
      BookingStatus.Expired,
    );
  });

  it('updates contact details only, without touching the stay', async () => {
    const created = await walkIn([roomA], '2094-06-10', '2094-06-12');
    const { body } = await patch(created.id, {
      guestName: 'Renamed Guest',
      guestPhone: '0944444444',
    }).expect(200);
    expect(body).toMatchObject({
      guestName: 'Renamed Guest',
      guestPhone: '0944444444',
      roomTotal: 2000000,
    });
    const saved = await bookings.findById(created.id).lean();
    expect(saved?.guestEmail).toBe(guest.guestEmail);
    expect(saved?.checkIn.toISOString()).toBe('2094-06-09T17:00:00.000Z');
  });

  it('only edits pending or confirmed bookings', async () => {
    const created = await walkIn([roomA], '2094-07-10', '2094-07-12');
    for (const status of [
      BookingStatus.Cancelled,
      BookingStatus.CheckedIn,
      BookingStatus.CheckedOut,
    ]) {
      await bookings.updateOne({ _id: created.id }, { $set: { status } });
      await patch(created.id, { adultCount: 1 }).expect(409);
    }
  });

  it('validates the request', async () => {
    const created = await walkIn([roomA], '2094-08-10', '2094-08-12');
    await patch(created.id, {}).expect(400);
    await patch(created.id, { adultCount: 10 }).expect(400); // vượt sức chứa
    await patch(created.id, { checkIn: '10/08/2094' }).expect(400);
    await patch(created.id, { checkIn: '2094-08-12' }).expect(400); // = checkOut
    await patch(created.id, { rooms: [] }).expect(400);
    await patch(created.id, { rooms: [String(roomA), String(roomA)] }).expect(
      400,
    );
    await patch(created.id, { unknown: 1 }).expect(400);
    await patch('not-an-id', { adultCount: 1 }).expect(400);
    await patch(String(new Types.ObjectId()), { adultCount: 1 }).expect(404);
  });
});
