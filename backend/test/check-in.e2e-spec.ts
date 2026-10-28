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

describe('Check in guest (e2e)', () => {
  let app: INestApplication;
  let bookings: Model<Booking>;
  let rooms: Model<Room>;
  let roomTypes: Model<RoomType>;
  const tag = String(new Types.ObjectId()).slice(-8).toUpperCase();
  const typeStd = new Types.ObjectId();
  const typeOther = new Types.ObjectId();
  const names = ['r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'rx'] as const;
  const ids = Object.fromEntries(
    names.map((name) => [name, new Types.ObjectId()]),
  ) as Record<(typeof names)[number], Types.ObjectId>;
  const http = () => request(app.getHttpServer());
  const RECEPTIONIST = {
    'x-dev-role': 'RECEPTIONIST',
    'x-dev-user-id': String(new Types.ObjectId()),
  };
  const vn = (day: string) => new Date(`${day}T00:00:00.000+07:00`);
  const day = (offset: number) =>
    businessDay(new Date(Date.now() + offset * 86_400_000));
  let counter = 0;

  const seed = (
    roomIds: Types.ObjectId[],
    options: {
      status?: BookingStatus;
      checkIn?: number;
      checkOut?: number;
    } = {},
  ) =>
    bookings.create({
      code: `CIN${tag}${++counter}`,
      guestName: 'Check In Guest',
      guestEmail: `cin-${tag}@example.test`,
      guestPhone: '0977777777',
      rooms: roomIds,
      checkIn: vn(day(options.checkIn ?? 0)),
      checkOut: vn(day(options.checkOut ?? 2)),
      adultCount: 2,
      childCount: 0,
      status: options.status ?? BookingStatus.Confirmed,
      roomTotal: 2000000 * roomIds.length,
      depositAmount: 600000,
      rateSnapshot: roomIds.map((room) => ({
        room,
        ratePerNight: 1000000,
      })),
    });
  const setStatus = (key: keyof typeof ids, status: string) =>
    rooms.updateOne({ _id: ids[key] }, { $set: { status } });
  const roomStatus = async (key: keyof typeof ids) =>
    (await rooms.findById(ids[key]).lean())?.status;
  const checkIn = (id: unknown, body: Record<string, unknown> = {}) =>
    http()
      .post(`/api/v1/bookings/${String(id)}/check-in`)
      .set(RECEPTIONIST)
      .send(body);
  const options = (id: unknown) =>
    http()
      .get(`/api/v1/bookings/${String(id)}/check-in-options`)
      .set(RECEPTIONIST);

  const reset = async () => {
    await bookings.deleteMany({ code: new RegExp(`^CIN${tag}`) });
    await rooms.updateMany(
      { _id: { $in: Object.values(ids) } },
      { $set: { status: 'AVAILABLE', isActive: true } },
    );
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
    rooms = app.get(getModelToken(Room.name));
    roomTypes = app.get(getModelToken(RoomType.name));
    await Promise.all([bookings.init(), rooms.init(), roomTypes.init()]);
    await roomTypes.create([
      {
        _id: typeStd,
        name: `CIN Std ${typeStd}`,
        adultCapacity: 2,
        childCapacity: 1,
        basePrice: 1000000,
      },
      {
        _id: typeOther,
        name: `CIN Other ${typeOther}`,
        adultCapacity: 2,
        childCapacity: 1,
        basePrice: 1000000,
      },
    ]);
    await rooms.create(
      names.map((name) => ({
        _id: ids[name],
        roomNumber: `CI-${name}-${tag}`,
        floor: 1,
        roomType: name === 'rx' ? typeOther : typeStd,
        status: 'AVAILABLE',
      })),
    );
  });

  beforeEach(reset);

  afterAll(async () => {
    await bookings.deleteMany({ code: new RegExp(`^CIN${tag}`) });
    await rooms.deleteMany({ _id: { $in: Object.values(ids) } });
    await roomTypes.deleteMany({ _id: { $in: [typeStd, typeOther] } });
    await app.close();
  });

  it('rejects customers and anonymous callers', async () => {
    const booking = await seed([ids.r1]);
    for (const [method, path] of [
      ['post', 'check-in'],
      ['get', 'check-in-options'],
    ] as const) {
      await http()
        [method](`/api/v1/bookings/${booking.id}/${path}`)
        .set({
          'x-dev-role': 'CUSTOMER',
          'x-dev-user-id': String(new Types.ObjectId()),
        })
        .expect(403);
      await http()
        [method](`/api/v1/bookings/${booking.id}/${path}`)
        .expect(401);
    }
  });

  it('checks a confirmed booking in and occupies its rooms', async () => {
    const booking = await seed([ids.r1, ids.r2]);
    const { body } = await checkIn(booking.id).expect(201);
    expect(body).toMatchObject({
      id: String(booking.id),
      code: booking.code,
      status: 'CHECKED_IN',
      rooms: [
        { id: String(ids.r1), roomNumber: `CI-r1-${tag}` },
        { id: String(ids.r2), roomNumber: `CI-r2-${tag}` },
      ],
    });
    expect(new Date(body.checkedInAt).getTime()).toBeGreaterThan(
      Date.now() - 60_000,
    );
    const saved = await bookings.findById(booking.id).lean();
    expect(saved?.status).toBe(BookingStatus.CheckedIn);
    expect(saved?.checkedInAt).toBeDefined();
    expect(await roomStatus('r1')).toBe('OCCUPIED');
    expect(await roomStatus('r2')).toBe('OCCUPIED');
  });

  it('lets a late guest in during the stay', async () => {
    const booking = await seed([ids.r1], { checkIn: -1, checkOut: 1 });
    await checkIn(booking.id).expect(201);
  });

  it('refuses bookings that cannot check in and changes nothing', async () => {
    const cases: [BookingStatus, RegExp][] = [
      [BookingStatus.PendingDeposit, /deposit/i],
      [BookingStatus.Cancelled, /cannot/i],
      [BookingStatus.CheckedIn, /already/i],
      [BookingStatus.CheckedOut, /cannot/i],
    ];
    for (const [status, message] of cases) {
      const booking = await seed([ids.r1], { status });
      const { body } = await checkIn(booking.id).expect(409);
      expect(body.message).toMatch(message);
      expect(await roomStatus('r1')).toBe('AVAILABLE');
      await bookings.deleteOne({ _id: booking._id });
    }
  });

  it('refuses arriving too early or after the stay has ended', async () => {
    const early = await seed([ids.r1], { checkIn: 1, checkOut: 3 });
    const tooEarly = await checkIn(early.id).expect(409);
    expect(tooEarly.body.message).toMatch(/too early/i);
    const ended = await seed([ids.r2], { checkIn: -3, checkOut: 0 });
    const tooLate = await checkIn(ended.id).expect(409);
    expect(tooLate.body.message).toMatch(/ended/i);
    expect(await roomStatus('r1')).toBe('AVAILABLE');
    expect((await bookings.findById(early.id).lean())?.status).toBe(
      BookingStatus.Confirmed,
    );
  });

  it('blocks check-in when a room is not ready and leaves everything untouched', async () => {
    await setStatus('r2', 'CLEANING');
    const booking = await seed([ids.r1, ids.r2]);
    const { body } = await checkIn(booking.id).expect(409);
    expect(body.message).toContain(`CI-r2-${tag} (CLEANING)`);
    expect((await bookings.findById(booking.id).lean())?.status).toBe(
      BookingStatus.Confirmed,
    );
    expect(await roomStatus('r1')).toBe('AVAILABLE');
    expect(await roomStatus('r2')).toBe('CLEANING');
  });

  it('swaps a room that is not ready for another room of the same type', async () => {
    await setStatus('r2', 'CLEANING');
    const booking = await seed([ids.r1, ids.r2]);
    const { body } = await checkIn(booking.id, {
      replacements: [{ from: String(ids.r2), to: String(ids.r3) }],
    }).expect(201);
    expect(body.rooms.map((room: { id: string }) => room.id)).toEqual([
      String(ids.r1),
      String(ids.r3),
    ]);
    const saved = await bookings.findById(booking.id).lean();
    expect(saved?.rooms.map(String)).toEqual([String(ids.r1), String(ids.r3)]);
    expect(saved?.rateSnapshot.map((entry) => String(entry.room))).toEqual([
      String(ids.r1),
      String(ids.r3),
    ]);
    // Cùng loại phòng nên tiền phòng không đổi.
    expect(saved?.roomTotal).toBe(4000000);
    expect(await roomStatus('r1')).toBe('OCCUPIED');
    expect(await roomStatus('r3')).toBe('OCCUPIED');
    expect(await roomStatus('r2')).toBe('CLEANING');
  });

  it('rejects unsuitable replacement rooms and leaves the booking untouched', async () => {
    await setStatus('r2', 'CLEANING');
    await setStatus('r5', 'CLEANING');
    const booking = await seed([ids.r1, ids.r2]);
    await seed([ids.r6]); // r6 đang bị booking khác chiếm cùng ngày.
    const attempts: [string, number][] = [
      [String(ids.rx), 409], // khác loại phòng
      [String(ids.r5), 409], // chưa sẵn sàng
      [String(ids.r6), 409], // đã có booking khác
      [String(ids.r1), 400], // đã thuộc booking
    ];
    for (const [to, status] of attempts) {
      await checkIn(booking.id, {
        replacements: [{ from: String(ids.r2), to }],
      }).expect(status);
    }
    await checkIn(booking.id, {
      replacements: [{ from: String(ids.r4), to: String(ids.r3) }],
    }).expect(400); // from không thuộc booking
    await checkIn(booking.id, {
      replacements: [{ from: 'nope', to: String(ids.r3) }],
    }).expect(400);
    const saved = await bookings.findById(booking.id).lean();
    expect(saved?.status).toBe(BookingStatus.Confirmed);
    expect(saved?.rooms.map(String)).toEqual([String(ids.r1), String(ids.r2)]);
    expect(await roomStatus('r1')).toBe('AVAILABLE');
    expect(await roomStatus('r3')).toBe('AVAILABLE');
  });

  it('lists per-room readiness and valid replacements', async () => {
    await setStatus('r2', 'CLEANING');
    await setStatus('r5', 'CLEANING');
    const booking = await seed([ids.r1, ids.r2]);
    await seed([ids.r4]); // r4 bị chiếm cùng ngày nên không là phòng thay thế.
    const { body } = await options(booking.id).expect(200);
    expect(body).toMatchObject({ bookingId: String(booking.id) });
    const [first, second] = body.rooms;
    expect(first).toMatchObject({
      id: String(ids.r1),
      ready: true,
      status: 'AVAILABLE',
      replacements: [],
    });
    expect(second).toMatchObject({
      id: String(ids.r2),
      ready: false,
      status: 'CLEANING',
    });
    // r3 và r6 hợp lệ; r4 đã có booking, r5 đang dọn, rx khác loại phòng.
    expect(second.replacements.map((room: { id: string }) => room.id)).toEqual([
      String(ids.r3),
      String(ids.r6),
    ]);
    expect(second.replacements[0]).toMatchObject({
      roomNumber: `CI-r3-${tag}`,
      floor: 1,
    });
  });

  it('refuses options for a booking that cannot check in', async () => {
    const booking = await seed([ids.r1], {
      status: BookingStatus.PendingDeposit,
    });
    await options(booking.id).expect(409);
  });

  it('lets only one of two simultaneous check-ins through', async () => {
    const booking = await seed([ids.r1, ids.r2]);
    const results = await Promise.all([
      checkIn(booking.id),
      checkIn(booking.id),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
    expect((await bookings.findById(booking.id).lean())?.status).toBe(
      BookingStatus.CheckedIn,
    );
    expect(await roomStatus('r1')).toBe('OCCUPIED');
    expect(await roomStatus('r2')).toBe('OCCUPIED');
  });

  it('lets only one booking take the same replacement room and rolls the other back', async () => {
    await setStatus('r2', 'CLEANING');
    await setStatus('r5', 'CLEANING');
    const first = await seed([ids.r1, ids.r2]);
    const second = await seed([ids.r4, ids.r5]);
    const results = await Promise.all([
      checkIn(first.id, {
        replacements: [{ from: String(ids.r2), to: String(ids.r3) }],
      }),
      checkIn(second.id, {
        replacements: [{ from: String(ids.r5), to: String(ids.r3) }],
      }),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
    const loser = results[0]?.status === 409 ? first : second;
    const savedLoser = await bookings.findById(loser.id).lean();
    expect(savedLoser?.status).toBe(BookingStatus.Confirmed);
    expect(savedLoser?.checkedInAt).toBeUndefined();
    expect(savedLoser?.rooms.map(String)).toEqual(loser.rooms.map(String));
    const loserRoom = loser === first ? 'r1' : 'r4';
    expect(await roomStatus(loserRoom)).toBe('AVAILABLE');
    expect(await roomStatus('r3')).toBe('OCCUPIED');
  });

  it('validates the booking id', async () => {
    await checkIn('not-an-id').expect(400);
    await checkIn(new Types.ObjectId()).expect(404);
    await options('not-an-id').expect(400);
    await options(new Types.ObjectId()).expect(404);
  });
});
