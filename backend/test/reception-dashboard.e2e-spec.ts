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
import { businessDay } from '../src/modules/bookings/room-status-board.core.js';
import { Feedback } from '../src/modules/feedback/schemas/feedback.schema.js';
import { Issue } from '../src/modules/issues/schemas/issue.schema.js';
import { Room } from '../src/modules/rooms/schemas/room.schema.js';
import { RoomType } from '../src/modules/room-types/schemas/room-type.schema.js';
import { ServiceOrder } from '../src/modules/service-orders/schemas/service-order.schema.js';

describe('Reception dashboard (e2e)', () => {
  let app: INestApplication;
  let bookings: Model<Booking>;
  let rooms: Model<Room>;
  let roomTypes: Model<RoomType>;
  let serviceOrders: Model<ServiceOrder>;
  let issues: Model<Issue>;
  let feedback: Model<Feedback>;
  const tag = String(new Types.ObjectId()).slice(-8).toUpperCase();
  const typeId = new Types.ObjectId();
  const ids = {
    reserved: new Types.ObjectId(),
    leaving: new Types.ObjectId(),
    unpaid: new Types.ObjectId(),
    broken: new Types.ObjectId(),
  };
  const http = () => request(app.getHttpServer());
  const RECEPTIONIST = {
    'x-dev-role': 'RECEPTIONIST',
    'x-dev-user-id': String(new Types.ObjectId()),
  };
  const vn = (day: string) => new Date(`${day}T00:00:00.000+07:00`);
  const day = (offset: number) =>
    businessDay(new Date(Date.now() + offset * 86_400_000));
  const dashboard = () =>
    http().get('/api/v1/dashboard/reception').set(RECEPTIONIST);

  const seedBooking = (
    suffix: string,
    roomId: Types.ObjectId,
    status: BookingStatus,
    checkIn: number,
    checkOut: number,
  ) =>
    bookings.create({
      code: `RDB${tag}${suffix}`,
      guestName: 'Dashboard Guest',
      guestEmail: `rdb-${tag}@example.test`,
      guestPhone: '0901111111',
      rooms: [roomId],
      checkIn: vn(day(checkIn)),
      checkOut: vn(day(checkOut)),
      adultCount: 2,
      childCount: 0,
      status,
      roomTotal: 1000000,
      depositAmount: 300000,
    });

  const clean = async () => {
    await bookings.deleteMany({ code: new RegExp(`^RDB${tag}`) });
    await serviceOrders.collection.deleteMany({ e2eTag: tag });
    await issues.collection.deleteMany({ e2eTag: tag });
    await feedback.deleteMany({ content: new RegExp(`^RDB ${tag}`) });
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
    serviceOrders = app.get(getModelToken(ServiceOrder.name));
    issues = app.get(getModelToken(Issue.name));
    feedback = app.get(getModelToken(Feedback.name));
    await Promise.all([bookings.init(), rooms.init(), roomTypes.init()]);
    await roomTypes.create({
      _id: typeId,
      name: `RDB Deluxe ${typeId}`,
      adultCapacity: 2,
      childCapacity: 1,
      basePrice: 1000000,
    });
    await rooms.create([
      {
        _id: ids.reserved,
        roomNumber: `RD-A-${tag}`,
        floor: 1,
        roomType: typeId,
        status: 'AVAILABLE',
      },
      {
        _id: ids.leaving,
        roomNumber: `RD-B-${tag}`,
        floor: 1,
        roomType: typeId,
        status: 'OCCUPIED',
      },
      {
        _id: ids.unpaid,
        roomNumber: `RD-C-${tag}`,
        floor: 1,
        roomType: typeId,
        status: 'AVAILABLE',
      },
      {
        _id: ids.broken,
        roomNumber: `RD-D-${tag}`,
        floor: 1,
        roomType: typeId,
        status: 'MAINTENANCE',
      },
    ]);
  });

  afterAll(async () => {
    await clean();
    await rooms.deleteMany({ _id: { $in: Object.values(ids) } });
    await roomTypes.deleteOne({ _id: typeId });
    await app.close();
  });

  it('lets receptionist and manager in, and rejects everyone else', async () => {
    await dashboard().expect(200);
    await http()
      .get('/api/v1/dashboard/reception')
      .set({
        'x-dev-role': 'MANAGER',
        'x-dev-user-id': String(new Types.ObjectId()),
      })
      .expect(200);
    for (const role of ['CUSTOMER', 'SERVICE_STAFF', 'OPERATIONS_STAFF']) {
      await http()
        .get('/api/v1/dashboard/reception')
        .set({
          'x-dev-role': role,
          'x-dev-user-id': String(new Types.ObjectId()),
        })
        .expect(403);
    }
    await http().get('/api/v1/dashboard/reception').expect(401);
  });

  it('refuses query parameters', async () => {
    await dashboard().query({ date: '2026-01-01' }).expect(400);
  });

  it("answers with today's date and all three blocks available", async () => {
    const { body } = await dashboard().expect(200);
    expect(new Date(body.generatedAt).getTime()).toBeGreaterThan(
      Date.now() - 60_000,
    );
    expect(body.frontDesk).toMatchObject({
      available: true,
      date: day(0),
    });
    expect(body.rooms).toMatchObject({ available: true, date: day(0) });
    expect(body.requests.available).toBe(true);
  });

  it('counts what changes today, without exposing guests or rooms', async () => {
    await clean();
    const before = (await dashboard().expect(200)).body;

    await seedBooking('RS', ids.reserved, BookingStatus.Confirmed, 0, 2);
    await seedBooking('DP', ids.leaving, BookingStatus.CheckedIn, -2, 0);
    await seedBooking('UP', ids.unpaid, BookingStatus.PendingDeposit, 0, 1);
    await serviceOrders.collection.insertOne({
      reviewStatus: 'PENDING_REVIEW',
      e2eTag: tag,
    });
    await issues.collection.insertOne({
      status: 'PENDING_REVIEW',
      e2eTag: tag,
    });
    await feedback.create([
      {
        customer: new Types.ObjectId(),
        booking: new Types.ObjectId(),
        content: `RDB ${tag} chưa trả lời`,
      },
      {
        customer: new Types.ObjectId(),
        booking: new Types.ObjectId(),
        content: `RDB ${tag} đã trả lời`,
        reply: {
          content: 'Cảm ơn',
          repliedBy: new Types.ObjectId(),
          repliedAt: new Date(),
        },
      },
    ]);

    const after = (await dashboard().expect(200)).body;
    const diff = (a: number, b: number) => a - b;

    expect(
      diff(after.frontDesk.arrivals.total, before.frontDesk.arrivals.total),
    ).toBe(2);
    expect(
      diff(
        after.frontDesk.arrivals.awaitingDeposit,
        before.frontDesk.arrivals.awaitingDeposit,
      ),
    ).toBe(1);
    expect(
      diff(after.frontDesk.arrivals.ready, before.frontDesk.arrivals.ready),
    ).toBe(1);
    expect(
      diff(after.frontDesk.departures.total, before.frontDesk.departures.total),
    ).toBe(1);
    expect(
      diff(
        after.frontDesk.departures.awaitingCheckOut,
        before.frontDesk.departures.awaitingCheckOut,
      ),
    ).toBe(1);

    // Bốn phòng đã có từ trước nên tổng không đổi; chỉ phòng được đặt chuyển từ trống sang đã đặt.
    // Phòng sắp trả và phòng chưa cọc chưa bị giữ trong ngày nên vẫn tính là trống.
    expect(diff(after.rooms.total, before.rooms.total)).toBe(0);
    expect(diff(after.rooms.reserved, before.rooms.reserved)).toBe(1);
    expect(diff(after.rooms.free, before.rooms.free)).toBe(-1);
    expect(diff(after.rooms.maintenance, before.rooms.maintenance)).toBe(0);
    expect(after.rooms.maintenance).toBeGreaterThanOrEqual(1);

    expect(
      diff(
        after.requests.serviceOrdersPendingReview,
        before.requests.serviceOrdersPendingReview,
      ),
    ).toBe(1);
    expect(
      diff(
        after.requests.issuesPendingReview,
        before.requests.issuesPendingReview,
      ),
    ).toBe(1);
    expect(
      diff(after.requests.feedbackUnreplied, before.requests.feedbackUnreplied),
    ).toBe(1);

    const text = JSON.stringify(after);
    expect(text).not.toContain('Dashboard Guest');
    expect(text).not.toContain('0901111111');
    expect(text).not.toContain(`RD-A-${tag}`);
  });
});
