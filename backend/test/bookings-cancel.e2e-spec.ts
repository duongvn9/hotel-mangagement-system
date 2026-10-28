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

describe('Cancel booking (e2e)', () => {
  let app: INestApplication;
  let bookings: Model<Booking>;
  let holds: Model<RoomHold>;
  let rooms: Model<Room>;
  let roomTypes: Model<RoomType>;
  const typeId = new Types.ObjectId();
  const roomId = new Types.ObjectId();
  const customerId = new Types.ObjectId();
  const http = () => request(app.getHttpServer());
  const CUSTOMER = {
    'x-dev-role': 'CUSTOMER',
    'x-dev-user-id': String(customerId),
  };
  const body = () => ({
    rooms: [String(roomId)],
    checkIn: '2093-01-10',
    checkOut: '2093-01-12',
    adultCount: 2,
    guestName: 'Canceller',
    guestEmail: 'cancel@example.test',
    guestPhone: '0900000000',
  });

  const clean = () => bookings.deleteMany({ rooms: { $in: [roomId] } });

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
    await roomTypes.create({
      _id: typeId,
      name: `CANCEL Deluxe ${typeId}`,
      adultCapacity: 2,
      childCapacity: 1,
      basePrice: 1000000,
    });
    await rooms.create({
      _id: roomId,
      roomNumber: `C-${roomId}`,
      floor: 1,
      roomType: typeId,
      status: 'AVAILABLE',
    });
  });

  beforeEach(clean);

  afterAll(async () => {
    await clean();
    await rooms.deleteOne({ _id: roomId });
    await roomTypes.deleteOne({ _id: typeId });
    await app.close();
  });

  const createOwned = () =>
    http().post('/api/v1/bookings').set(CUSTOMER).send(body()).expect(201);

  it('cancels the owner booking, releases the hold and frees the room', async () => {
    const created = await createOwned();
    const res = await http()
      .post(`/api/v1/bookings/${created.body.id}/cancel`)
      .set(CUSTOMER)
      .send({})
      .expect(201);
    expect(res.body.status).toBe('CANCELLED');
    const hold = await holds
      .findOne({ booking: new Types.ObjectId(created.body.id) })
      .lean();
    expect(hold?.isActive).toBe(false);
    // Phòng được giải phóng: đặt lại cùng phòng/ngày thành công.
    await http()
      .post('/api/v1/bookings')
      .set(CUSTOMER)
      .send(body())
      .expect(201);
  });

  it('forbids a different customer from cancelling', async () => {
    const created = await createOwned();
    await http()
      .post(`/api/v1/bookings/${created.body.id}/cancel`)
      .set({
        'x-dev-role': 'CUSTOMER',
        'x-dev-user-id': String(new Types.ObjectId()),
      })
      .send({})
      .expect(403);
  });

  it('lets a guest cancel an unlinked booking with the code', async () => {
    const created = await http()
      .post('/api/v1/bookings')
      .send(body())
      .expect(201);
    await http()
      .post(`/api/v1/bookings/${created.body.id}/cancel`)
      .send({ code: created.body.code })
      .expect(201);
  });

  it('rejects a guest cancel without the code', async () => {
    const created = await http()
      .post('/api/v1/bookings')
      .send(body())
      .expect(201);
    await http()
      .post(`/api/v1/bookings/${created.body.id}/cancel`)
      .send({})
      .expect(401);
  });

  it('cannot cancel a checked-in booking', async () => {
    const created = await createOwned();
    await bookings.updateOne(
      { _id: new Types.ObjectId(created.body.id) },
      { $set: { status: 'CHECKED_IN' } },
    );
    await http()
      .post(`/api/v1/bookings/${created.body.id}/cancel`)
      .set(CUSTOMER)
      .send({})
      .expect(409);
  });
});
