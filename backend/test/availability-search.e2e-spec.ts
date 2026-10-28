import { VersioningType, type INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { Model, Types } from 'mongoose';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { Booking } from '../src/modules/bookings/schemas/booking.schema.js';
import { Room } from '../src/modules/rooms/schemas/room.schema.js';
import { RoomType } from '../src/modules/room-types/schemas/room-type.schema.js';

// UC05 end-to-end qua HTTP với Room/RoomType thật.
describe('UC05 search available rooms (e2e)', () => {
  let app: INestApplication;
  let rooms: Model<Room>;
  let roomTypes: Model<RoomType>;
  let bookings: Model<Booking>;
  const typeId = new Types.ObjectId();
  const smallTypeId = new Types.ObjectId();
  const roomAvailable = new Types.ObjectId();
  const roomBooked = new Types.ObjectId();
  const roomMaintenance = new Types.ObjectId();
  const roomSmall = new Types.ObjectId();
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    await app.init();
    rooms = app.get(getModelToken(Room.name));
    roomTypes = app.get(getModelToken(RoomType.name));
    bookings = app.get(getModelToken(Booking.name));
    await Promise.all([rooms.init(), roomTypes.init(), bookings.init()]);

    await roomTypes.create([
      {
        _id: typeId,
        name: `UC05 Deluxe ${typeId}`,
        adultCapacity: 2,
        childCapacity: 1,
        basePrice: 1000000,
      },
      {
        _id: smallTypeId,
        name: `UC05 Single ${smallTypeId}`,
        adultCapacity: 1,
        childCapacity: 0,
        basePrice: 500000,
      },
    ]);
    await rooms.create([
      {
        _id: roomAvailable,
        roomNumber: `U5-A-${roomAvailable}`,
        floor: 1,
        roomType: typeId,
        status: 'AVAILABLE',
      },
      {
        _id: roomBooked,
        roomNumber: `U5-B-${roomBooked}`,
        floor: 1,
        roomType: typeId,
        status: 'AVAILABLE',
      },
      {
        _id: roomMaintenance,
        roomNumber: `U5-M-${roomMaintenance}`,
        floor: 1,
        roomType: typeId,
        status: 'MAINTENANCE',
      },
      {
        _id: roomSmall,
        roomNumber: `U5-S-${roomSmall}`,
        floor: 1,
        roomType: smallTypeId,
        status: 'AVAILABLE',
      },
    ]);
    // Một booking CONFIRMED chiếm roomBooked trong khoảng tìm kiếm.
    await bookings.create({
      code: `U5-BK-${roomBooked}`,
      rooms: [roomBooked],
      guestName: 'Occupied',
      guestEmail: 'occ@example.test',
      guestPhone: '0900000000',
      checkIn: new Date('2090-01-10T00:00:00+07:00'),
      checkOut: new Date('2090-01-15T00:00:00+07:00'),
      adultCount: 2,
      status: 'CONFIRMED',
      roomTotal: 1000000,
      depositAmount: 300000,
    });
  });

  afterAll(async () => {
    await bookings.deleteMany({ rooms: { $in: [roomBooked] } });
    await rooms.deleteMany({
      _id: { $in: [roomAvailable, roomBooked, roomMaintenance, roomSmall] },
    });
    await roomTypes.deleteMany({ _id: { $in: [typeId, smallTypeId] } });
    await app.close();
  });

  it('returns the free room, excluding the booked and the maintenance room', async () => {
    const response = await http()
      .get('/api/v1/availability')
      .query({
        checkIn: '2090-01-11',
        checkOut: '2090-01-13',
        guests: 2,
        roomTypeId: String(typeId),
      })
      .expect(200);
    const ids = (response.body as { id: string }[]).map((room) => room.id);
    expect(ids).toContain(String(roomAvailable));
    expect(ids).not.toContain(String(roomBooked));
    expect(ids).not.toContain(String(roomMaintenance));
    expect(response.body[0]).toMatchObject({
      roomTypeId: String(typeId),
      capacity: 3,
    });
  });

  it('frees the room for a non-overlapping stay', async () => {
    const response = await http()
      .get('/api/v1/availability')
      .query({
        checkIn: '2090-02-01',
        checkOut: '2090-02-03',
        guests: 2,
        roomTypeId: String(typeId),
      })
      .expect(200);
    const ids = (response.body as { id: string }[]).map((room) => room.id);
    expect(ids).toContain(String(roomAvailable));
    expect(ids).toContain(String(roomBooked));
  });

  it('excludes room types that cannot hold the party size', async () => {
    const response = await http()
      .get('/api/v1/availability')
      .query({ checkIn: '2090-02-01', checkOut: '2090-02-03', guests: 3 })
      .expect(200);
    const ids = (response.body as { id: string }[]).map((room) => room.id);
    expect(ids).toContain(String(roomAvailable));
    expect(ids).not.toContain(String(roomSmall));
  });

  it('rejects an invalid stay window', async () => {
    await http()
      .get('/api/v1/availability')
      .query({ checkIn: '2090-02-05', checkOut: '2090-02-03', guests: 2 })
      .expect(400);
  });

  it('rejects a missing guest count', async () => {
    await http()
      .get('/api/v1/availability')
      .query({ checkIn: '2090-02-01', checkOut: '2090-02-03' })
      .expect(400);
  });
});
