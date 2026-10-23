import { VersioningType, type INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { Model, Types } from 'mongoose';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { Booking } from '../src/modules/bookings/schemas/booking.schema.js';
import { RoomHold } from '../src/modules/bookings/schemas/room-hold.schema.js';
import { Room } from '../src/modules/rooms/schemas/room.schema.js';
import { RoomType } from '../src/modules/room-types/schemas/room-type.schema.js';

describe('Create booking (e2e)', () => {
  let app: INestApplication;
  let bookings: Model<Booking>;
  let holds: Model<RoomHold>;
  let rooms: Model<Room>;
  let roomTypes: Model<RoomType>;
  const typeId = new Types.ObjectId();
  const roomA = new Types.ObjectId();
  const roomB = new Types.ObjectId();
  const maintenanceRoom = new Types.ObjectId();
  const customerId = new Types.ObjectId();
  const http = () => request(app.getHttpServer());
  const CUSTOMER = { 'x-dev-role': 'CUSTOMER', 'x-dev-user-id': String(customerId) };
  const guest = { guestName: 'Booker', guestEmail: 'booker@example.test', guestPhone: '0900000000' };

  const body = (roomIds: Types.ObjectId[], checkIn: string, checkOut: string, guests = 2) => ({
    rooms: roomIds.map(String),
    checkIn,
    checkOut,
    guests,
    ...guest,
  });

  const clean = async () => {
    const roomList = [roomA, roomB, maintenanceRoom];
    const docs = await bookings.find({ rooms: { $in: roomList } }).select('_id').lean();
    await holds.deleteMany({ booking: { $in: docs.map((d) => d._id) } });
    await bookings.deleteMany({ rooms: { $in: roomList } });
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    await app.init();
    bookings = app.get(getModelToken(Booking.name));
    holds = app.get(getModelToken(RoomHold.name));
    rooms = app.get(getModelToken(Room.name));
    roomTypes = app.get(getModelToken(RoomType.name));
    await Promise.all([bookings.init(), holds.init(), rooms.init(), roomTypes.init()]);
    await roomTypes.create({
      _id: typeId,
      name: `BOOK Deluxe ${typeId}`,
      adultCapacity: 2,
      childCapacity: 1,
      basePrice: 1000000,
    });
    await rooms.create([
      { _id: roomA, roomNumber: `BK-A-${roomA}`, floor: 1, roomType: typeId, status: 'AVAILABLE' },
      { _id: roomB, roomNumber: `BK-B-${roomB}`, floor: 1, roomType: typeId, status: 'AVAILABLE' },
      { _id: maintenanceRoom, roomNumber: `BK-M-${maintenanceRoom}`, floor: 1, roomType: typeId, status: 'MAINTENANCE' },
    ]);
  });

  beforeEach(clean);

  afterAll(async () => {
    await clean();
    await rooms.deleteMany({ _id: { $in: [roomA, roomB, maintenanceRoom] } });
    await roomTypes.deleteOne({ _id: typeId });
    await app.close();
  });

  it('requires authentication', async () => {
    await http().post('/api/v1/bookings').send(body([roomA], '2091-01-10', '2091-01-12')).expect(401);
  });

  it('creates a pending-deposit booking, holds the room and prices it server-side', async () => {
    const response = await http()
      .post('/api/v1/bookings')
      .set(CUSTOMER)
      .send(body([roomA], '2091-01-10', '2091-01-12'))
      .expect(201);
    expect(response.body).toMatchObject({
      status: 'PENDING_DEPOSIT',
      roomTotal: 2000000, // 1 phòng x 2 đêm x 1.000.000
      depositAmount: 2000000,
      guests: 2,
    });
    expect(response.body.code).toMatch(/^BK/);
    const saved = await bookings.findById(response.body.id).lean();
    expect(String(saved?.customer)).toBe(String(customerId));
    const hold = await holds.findOne({ booking: new Types.ObjectId(response.body.id) }).lean();
    expect(hold?.isActive).toBe(true);
    expect(hold?.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('rejects a second overlapping booking on the held room', async () => {
    await http().post('/api/v1/bookings').set(CUSTOMER).send(body([roomA], '2091-01-10', '2091-01-12')).expect(201);
    await http().post('/api/v1/bookings').set(CUSTOMER).send(body([roomA], '2091-01-11', '2091-01-13')).expect(409);
  });

  it('allows a non-overlapping stay on the same room', async () => {
    await http().post('/api/v1/bookings').set(CUSTOMER).send(body([roomA], '2091-01-10', '2091-01-12')).expect(201);
    await http().post('/api/v1/bookings').set(CUSTOMER).send(body([roomA], '2091-01-12', '2091-01-14')).expect(201);
  });

  it('lets only one of two concurrent bookings win the same room', async () => {
    const results = await Promise.all([
      http().post('/api/v1/bookings').set(CUSTOMER).send(body([roomA], '2091-02-01', '2091-02-03')),
      http().post('/api/v1/bookings').set(CUSTOMER).send(body([roomA], '2091-02-01', '2091-02-03')),
    ]);
    const statuses = results.map((r) => r.status).sort();
    expect(statuses).toEqual([201, 409]);
    // Kẻ thua đã rollback: đúng một hold còn hiệu lực cho phòng.
    const active = await holds.countDocuments({ rooms: roomA, isActive: true, expiresAt: { $gt: new Date() } });
    expect(active).toBe(1);
    expect(await bookings.countDocuments({ rooms: roomA })).toBe(1);
  });

  it('rejects a party larger than the room capacity', async () => {
    await http().post('/api/v1/bookings').set(CUSTOMER).send(body([roomA], '2091-01-10', '2091-01-12', 5)).expect(400);
  });

  it('rejects a maintenance room', async () => {
    await http().post('/api/v1/bookings').set(CUSTOMER).send(body([maintenanceRoom], '2091-01-10', '2091-01-12')).expect(409);
  });

  it('rejects a room that does not exist', async () => {
    await http().post('/api/v1/bookings').set(CUSTOMER).send(body([new Types.ObjectId()], '2091-01-10', '2091-01-12')).expect(400);
  });
});
