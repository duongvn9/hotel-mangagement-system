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
import { Room } from '../src/modules/rooms/schemas/room.schema.js';
import { RoomType } from '../src/modules/room-types/schemas/room-type.schema.js';
import { businessDay } from '../src/modules/bookings/room-status-board.core.js';

describe('Same-day check-in/out list (e2e)', () => {
  let app: INestApplication;
  let bookings: Model<Booking>;
  let rooms: Model<Room>;
  let roomTypes: Model<RoomType>;
  const tag = String(new Types.ObjectId()).slice(-8).toUpperCase();
  const typeId = new Types.ObjectId();
  const ids = {
    r1: new Types.ObjectId(),
    r2: new Types.ObjectId(),
    r3: new Types.ObjectId(),
    r4: new Types.ObjectId(),
    r5: new Types.ObjectId(),
    r6: new Types.ObjectId(),
    r7: new Types.ObjectId(),
  };
  const http = () => request(app.getHttpServer());
  const RECEPTIONIST = {
    'x-dev-role': 'RECEPTIONIST',
    'x-dev-user-id': String(new Types.ObjectId()),
  };
  const vn = (day: string) => new Date(`${day}T00:00:00.000+07:00`);
  const day = '2097-05-10';
  const sameDay = (query: Record<string, string> = {}) =>
    http()
      .get('/api/v1/front-desk/same-day')
      .set(RECEPTIONIST)
      .query({ date: day, ...query });
  const codes = (items: { code: string }[]) => items.map((item) => item.code);

  const seed = (
    suffix: string,
    roomId: Types.ObjectId,
    status: BookingStatus,
    checkIn: string,
    checkOut: string,
  ) =>
    bookings.create({
      code: `FD${tag}${suffix}`,
      guestName: `Guest ${suffix}`,
      guestEmail: `${suffix.toLowerCase()}-${tag}@example.test`,
      guestPhone: '0966666666',
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
    rooms = app.get(getModelToken(Room.name));
    roomTypes = app.get(getModelToken(RoomType.name));
    await Promise.all([bookings.init(), rooms.init(), roomTypes.init()]);
    await roomTypes.create({
      _id: typeId,
      name: `FD Deluxe ${typeId}`,
      adultCapacity: 2,
      childCapacity: 1,
      basePrice: 1000000,
    });
    // Số phòng đặt tên để kiểm tra thứ tự sắp xếp theo số phòng (kiểu số).
    const numbers = {
      r1: '210',
      r2: '95',
      r3: '101',
      r4: '102',
      r5: '103',
      r6: '104',
      r7: '105',
    };
    await rooms.create(
      (Object.keys(ids) as (keyof typeof ids)[]).map((key) => ({
        _id: ids[key],
        roomNumber: `${numbers[key]}-${tag}`,
        floor: 1,
        roomType: typeId,
        status: 'AVAILABLE',
      })),
    );
    // Khách đến hôm nay: đã xác nhận, chưa cọc, đã nhận phòng.
    await seed(
      'ARC',
      ids.r1,
      BookingStatus.Confirmed,
      '2097-05-10',
      '2097-05-12',
    );
    await seed(
      'ARP',
      ids.r2,
      BookingStatus.PendingDeposit,
      '2097-05-10',
      '2097-05-11',
    );
    await seed(
      'ARI',
      ids.r3,
      BookingStatus.CheckedIn,
      '2097-05-10',
      '2097-05-13',
    );
    // Khách đi hôm nay: đang ở, đã trả phòng.
    await seed(
      'DPI',
      ids.r4,
      BookingStatus.CheckedIn,
      '2097-05-08',
      '2097-05-10',
    );
    await seed(
      'DPO',
      ids.r5,
      BookingStatus.CheckedOut,
      '2097-05-08',
      '2097-05-10',
    );
    // Không thuộc danh sách: huỷ, ở xuyên ngày, nhận ngày khác.
    await seed(
      'CXL',
      ids.r6,
      BookingStatus.Cancelled,
      '2097-05-10',
      '2097-05-12',
    );
    await seed(
      'OVR',
      ids.r7,
      BookingStatus.CheckedIn,
      '2097-05-09',
      '2097-05-12',
    );
    await seed(
      'NXT',
      ids.r6,
      BookingStatus.Confirmed,
      '2097-05-11',
      '2097-05-12',
    );
  });

  afterAll(async () => {
    await bookings.deleteMany({ code: new RegExp(`^FD${tag}`) });
    await rooms.deleteMany({ _id: { $in: Object.values(ids) } });
    await roomTypes.deleteOne({ _id: typeId });
    await app.close();
  });

  it('lets receptionist and manager view the list, and rejects others', async () => {
    await sameDay().expect(200);
    await http()
      .get('/api/v1/front-desk/same-day')
      .set({
        'x-dev-role': 'MANAGER',
        'x-dev-user-id': String(new Types.ObjectId()),
      })
      .expect(200);
    await http()
      .get('/api/v1/front-desk/same-day')
      .set({
        'x-dev-role': 'CUSTOMER',
        'x-dev-user-id': String(new Types.ObjectId()),
      })
      .expect(403);
    await http().get('/api/v1/front-desk/same-day').expect(401);
  });

  it('lists arrivals and departures of the day and leaves out the rest', async () => {
    const { body } = await sameDay().expect(200);
    expect(body.date).toBe(day);
    const mine = (items: { code: string }[]) =>
      codes(items).filter((code) => code.startsWith(`FD${tag}`));
    // Sắp theo số phòng kiểu số: 95 < 101 < 210.
    expect(mine(body.arrivals)).toEqual([
      `FD${tag}ARP`,
      `FD${tag}ARI`,
      `FD${tag}ARC`,
    ]);
    expect(mine(body.departures)).toEqual([`FD${tag}DPI`, `FD${tag}DPO`]);
  });

  it('returns the shared booking row with room number and type', async () => {
    const { body } = await sameDay().expect(200);
    const row = body.arrivals.find(
      (item: { code: string }) => item.code === `FD${tag}ARC`,
    );
    expect(row).toMatchObject({
      status: 'CONFIRMED',
      guestName: 'Guest ARC',
      guestPhone: '0966666666',
      guests: 2,
      roomTotal: 1000000,
      walkIn: false,
      checkIn: vn('2097-05-10').toISOString(),
      checkOut: vn('2097-05-12').toISOString(),
      rooms: [
        {
          id: String(ids.r1),
          roomNumber: `210-${tag}`,
          roomTypeName: `FD Deluxe ${typeId}`,
        },
      ],
    });
  });

  it('summarises how much is still to do', async () => {
    const { body } = await sameDay().expect(200);
    // Các booking của test khác trên cùng ngày không tồn tại ở năm 2097 nên tổng khớp đúng.
    expect(body.summary).toEqual({
      arrivals: { total: 3, awaitingDeposit: 1, ready: 1, checkedIn: 1 },
      departures: { total: 2, awaitingCheckOut: 1, checkedOut: 1 },
    });
  });

  it('defaults to today and handles days with nothing', async () => {
    const today = await http()
      .get('/api/v1/front-desk/same-day')
      .set(RECEPTIONIST)
      .expect(200);
    expect(today.body.date).toBe(businessDay(new Date()));
    const empty = await sameDay({ date: '2097-12-31' }).expect(200);
    expect(empty.body.arrivals).toEqual([]);
    expect(empty.body.departures).toEqual([]);
    expect(empty.body.summary.arrivals.total).toBe(0);
  });

  it('validates the date', async () => {
    await sameDay({ date: '10/05/2097' }).expect(400);
    await sameDay({ date: '2097-13-45' }).expect(400);
  });
});
