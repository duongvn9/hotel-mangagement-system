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
import { businessDay } from '../src/modules/bookings/room-status-board.core.js';

describe('Room status board (e2e)', () => {
  let app: INestApplication;
  let bookings: Model<Booking>;
  let holds: Model<RoomHold>;
  let rooms: Model<Room>;
  let roomTypes: Model<RoomType>;
  const tag = String(new Types.ObjectId()).slice(-8).toUpperCase();
  const typeId = new Types.ObjectId();
  const otherTypeId = new Types.ObjectId();
  const ids = {
    inHouse: new Types.ObjectId(),
    reserved: new Types.ObjectId(),
    held: new Types.ObjectId(),
    expired: new Types.ObjectId(),
    maintenance: new Types.ObjectId(),
    cleaning: new Types.ObjectId(),
    upstairs: new Types.ObjectId(),
  };
  const http = () => request(app.getHttpServer());
  const RECEPTIONIST = {
    'x-dev-role': 'RECEPTIONIST',
    'x-dev-user-id': String(new Types.ObjectId()),
  };
  const vn = (day: string) => new Date(`${day}T00:00:00.000+07:00`);
  const board = (query: Record<string, string> = {}) =>
    http()
      .get('/api/v1/room-status-board')
      .set(RECEPTIONIST)
      .query({ roomTypeId: String(typeId), ...query });
  const entry = (
    body: { rooms: { id: string }[] },
    id: Types.ObjectId,
  ): Record<string, unknown> =>
    body.rooms.find((room) => room.id === String(id)) as Record<
      string,
      unknown
    >;

  const seed = (
    suffix: string,
    roomId: Types.ObjectId,
    status: BookingStatus,
    checkIn: string,
    checkOut: string,
  ) =>
    bookings.create({
      code: `BRD${tag}${suffix}`,
      guestName: `Guest ${suffix}`,
      guestEmail: `${suffix.toLowerCase()}-${tag}@example.test`,
      guestPhone: '0955555555',
      rooms: [roomId],
      checkIn: vn(checkIn),
      checkOut: vn(checkOut),
      guests: 2,
      status,
      roomTotal: 1000000,
      depositAmount: 300000,
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
        _id: typeId,
        name: `BOARD Deluxe ${typeId}`,
        adultCapacity: 2,
        childCapacity: 1,
        basePrice: 1000000,
      },
      {
        _id: otherTypeId,
        name: `BOARD Other ${otherTypeId}`,
        adultCapacity: 1,
        childCapacity: 0,
        basePrice: 500000,
      },
    ]);
    const make = (
      key: keyof typeof ids,
      floor: number,
      status = 'AVAILABLE',
      roomType = typeId,
    ) => ({
      _id: ids[key],
      roomNumber: `BD-${key}-${ids[key]}`,
      floor,
      roomType,
      status,
    });
    await rooms.create([
      make('inHouse', 1),
      make('reserved', 1),
      make('held', 2),
      make('expired', 2),
      make('maintenance', 3, 'MAINTENANCE'),
      make('cleaning', 3, 'CLEANING'),
      make('upstairs', 9, 'AVAILABLE', otherTypeId),
    ]);
    await seed(
      'IN',
      ids.inHouse,
      BookingStatus.CheckedIn,
      '2095-03-08',
      '2095-03-12',
    );
    await seed(
      'RS',
      ids.reserved,
      BookingStatus.Confirmed,
      '2095-03-10',
      '2095-03-12',
    );
    const pending = await seed(
      'HD',
      ids.held,
      BookingStatus.PendingDeposit,
      '2095-03-10',
      '2095-03-12',
    );
    await holds.create({
      booking: pending._id,
      rooms: [ids.held],
      checkIn: vn('2095-03-10'),
      checkOut: vn('2095-03-12'),
      expiresAt: new Date(Date.now() + 3_600_000),
    });
    const stale = await seed(
      'EX',
      ids.expired,
      BookingStatus.PendingDeposit,
      '2095-03-10',
      '2095-03-12',
    );
    await holds.collection.insertOne({
      booking: stale._id,
      rooms: [ids.expired],
      checkIn: vn('2095-03-10'),
      checkOut: vn('2095-03-12'),
      expiresAt: new Date(Date.now() - 3_600_000),
      isActive: true,
    });
  });

  afterAll(async () => {
    const docs = await bookings
      .find({ code: new RegExp(`^BRD${tag}`) })
      .select('_id')
      .lean();
    await holds.deleteMany({ booking: { $in: docs.map((d) => d._id) } });
    await bookings.deleteMany({ code: new RegExp(`^BRD${tag}`) });
    await rooms.deleteMany({ _id: { $in: Object.values(ids) } });
    await roomTypes.deleteMany({ _id: { $in: [typeId, otherTypeId] } });
    await app.close();
  });

  it('lets receptionist and manager view the board, and rejects others', async () => {
    await board().expect(200);
    await http()
      .get('/api/v1/room-status-board')
      .set({
        'x-dev-role': 'MANAGER',
        'x-dev-user-id': String(new Types.ObjectId()),
      })
      .expect(200);
    await http()
      .get('/api/v1/room-status-board')
      .set({
        'x-dev-role': 'CUSTOMER',
        'x-dev-user-id': String(new Types.ObjectId()),
      })
      .expect(403);
    await http().get('/api/v1/room-status-board').expect(401);
  });

  it('derives occupancy per room for the chosen day', async () => {
    const { body } = await board({ date: '2095-03-10' }).expect(200);
    expect(body.date).toBe('2095-03-10');
    expect(entry(body, ids.inHouse)).toMatchObject({
      occupancy: 'IN_HOUSE',
      booking: {
        code: `BRD${tag}IN`,
        guestName: 'Guest IN',
        status: 'CHECKED_IN',
      },
    });
    expect(entry(body, ids.reserved)).toMatchObject({
      occupancy: 'RESERVED',
      booking: { code: `BRD${tag}RS` },
    });
    expect(entry(body, ids.held)).toMatchObject({ occupancy: 'HELD' });
    // Hold đã hết hạn thì phòng coi như trống.
    expect(entry(body, ids.expired)).toMatchObject({
      occupancy: 'FREE',
      booking: null,
    });
    expect(entry(body, ids.maintenance)).toMatchObject({
      occupancy: 'FREE',
      physicalStatus: 'MAINTENANCE',
    });
    expect(body.summary).toMatchObject({
      total: 6,
      inHouse: 1,
      reserved: 1,
      held: 1,
      maintenance: 1,
      free: 2, // hold hết hạn + đang dọn (phòng bảo trì không tính)
    });
  });

  it('frees a room on its check-out day and before check-in', async () => {
    const checkOutDay = await board({ date: '2095-03-12' }).expect(200);
    expect(entry(checkOutDay.body, ids.reserved)).toMatchObject({
      occupancy: 'FREE',
    });
    const before = await board({ date: '2095-03-07' }).expect(200);
    expect(entry(before.body, ids.inHouse)).toMatchObject({
      occupancy: 'FREE',
    });
  });

  it('shows occupied/cleaning only for today, maintenance always', async () => {
    const future = await board({ date: '2095-03-10' }).expect(200);
    expect(entry(future.body, ids.cleaning)).toMatchObject({
      physicalStatus: null,
    });
    const today = await board().expect(200);
    expect(today.body.date).toBe(businessDay(new Date()));
    expect(entry(today.body, ids.cleaning)).toMatchObject({
      physicalStatus: 'CLEANING',
    });
    expect(entry(today.body, ids.maintenance)).toMatchObject({
      physicalStatus: 'MAINTENANCE',
    });
  });

  it('filters by floor and room type, ordered by floor', async () => {
    const floor = await board({ floor: '2', date: '2095-03-10' }).expect(200);
    expect(floor.body.rooms).toHaveLength(2);
    expect(
      floor.body.rooms.every((room: { floor: number }) => room.floor === 2),
    ).toBe(true);
    const all = await board({ date: '2095-03-10' }).expect(200);
    const floors = all.body.rooms.map((room: { floor: number }) => room.floor);
    expect(floors).toEqual([...floors].sort((a, b) => a - b));
    const other = await http()
      .get('/api/v1/room-status-board')
      .set(RECEPTIONIST)
      .query({ roomTypeId: String(otherTypeId), date: '2095-03-10' })
      .expect(200);
    expect(other.body.rooms.map((room: { id: string }) => room.id)).toEqual([
      String(ids.upstairs),
    ]);
  });

  it('includes room type name, capacity and number', async () => {
    const { body } = await board({ date: '2095-03-10' }).expect(200);
    expect(entry(body, ids.inHouse)).toMatchObject({
      roomNumber: `BD-inHouse-${ids.inHouse}`,
      floor: 1,
      roomTypeId: String(typeId),
      roomTypeName: `BOARD Deluxe ${typeId}`,
      capacity: 3,
    });
  });

  it('validates the query', async () => {
    await board({ date: '27/10/2095' }).expect(400);
    await board({ date: '2095-13-45' }).expect(400);
    await board({ floor: 'x' }).expect(400);
    await http()
      .get('/api/v1/room-status-board')
      .set(RECEPTIONIST)
      .query({ roomTypeId: 'nope' })
      .expect(400);
  });
});
