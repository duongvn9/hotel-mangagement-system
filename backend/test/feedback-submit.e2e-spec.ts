import { VersioningType, type INestApplication } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { Types, type Model } from 'mongoose';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import {
  Booking,
  BookingStatus,
} from '../src/modules/bookings/schemas/booking.schema.js';
import { Feedback } from '../src/modules/feedback/schemas/feedback.schema.js';
import { User } from '../src/modules/users/schemas/user.schema.js';

// UC39. Cần MongoDB.
describe('Submit feedback (e2e)', () => {
  let app: INestApplication;
  let users: Model<User>;
  let bookings: Model<Booking>;
  let feedback: Model<Feedback>;
  const tag = String(new Types.ObjectId()).slice(-8).toUpperCase();
  let customerId: Types.ObjectId;
  let otherId: Types.ObjectId;
  let receptionistId: Types.ObjectId;
  let counter = 0;
  const http = () => request(app.getHttpServer());
  const asCustomer = () => ({
    'x-dev-role': 'CUSTOMER',
    'x-dev-user-id': String(customerId),
  });
  const vn = (day: string) => new Date(`${day}T00:00:00.000+07:00`);

  const stay = (
    owner: Types.ObjectId | undefined,
    options: { status?: BookingStatus; checkOut?: string } = {},
  ) => {
    const checkOut = options.checkOut ?? '2097-06-12';
    return bookings.create({
      code: `FBS${tag}${++counter}`,
      ...(owner ? { customer: owner } : {}),
      guestName: 'Feedback Guest',
      guestEmail: `fbs-${tag}@example.test`,
      guestPhone: '0911000000',
      rooms: [new Types.ObjectId()],
      checkIn: vn('2097-06-10'),
      checkOut: vn(checkOut),
      adultCount: 2,
      childCount: 0,
      status: options.status ?? BookingStatus.CheckedOut,
      roomTotal: 2000000,
      depositAmount: 600000,
    });
  };
  const submit = (body: Record<string, unknown>) =>
    http().post('/api/v1/feedback').set(asCustomer()).send(body);
  const mine = () => http().get('/api/v1/feedback/mine').set(asCustomer());

  const clean = async () => {
    const docs = await bookings
      .find({ code: new RegExp(`^FBS${tag}`) })
      .select('_id')
      .lean();
    await feedback.deleteMany({ booking: { $in: docs.map((d) => d._id) } });
    await bookings.deleteMany({ code: new RegExp(`^FBS${tag}`) });
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    await app.init();
    users = app.get(getModelToken(User.name));
    bookings = app.get(getModelToken(Booking.name));
    feedback = app.get(getModelToken(Feedback.name));
    await Promise.all([users.init(), bookings.init(), feedback.init()]);
    const [customer, other, receptionist] = await users.create([
      {
        email: `khach-${tag}@feedback-submit-e2e.vn`,
        fullName: 'Khách Gửi Phản Hồi',
        role: 'CUSTOMER',
      },
      {
        email: `khac-${tag}@feedback-submit-e2e.vn`,
        fullName: 'Khách Khác',
        role: 'CUSTOMER',
      },
      {
        email: `letan-${tag}@feedback-submit-e2e.vn`,
        fullName: 'Lễ Tân Trả Lời',
        role: 'RECEPTIONIST',
      },
    ]);
    customerId = customer!._id;
    otherId = other!._id;
    receptionistId = receptionist!._id;
  });

  beforeEach(clean);

  afterAll(async () => {
    await clean();
    await users.deleteMany({ email: /@feedback-submit-e2e\.vn$/ });
    await app.close();
  });

  it('rejects staff and anonymous callers', async () => {
    const booking = await stay(customerId);
    await http()
      .post('/api/v1/feedback')
      .set({
        'x-dev-role': 'RECEPTIONIST',
        'x-dev-user-id': String(receptionistId),
      })
      .send({ bookingId: String(booking._id), content: 'Tốt' })
      .expect(403);
    await http()
      .post('/api/v1/feedback')
      .send({ bookingId: String(booking._id), content: 'Tốt' })
      .expect(401);
    await http()
      .get('/api/v1/feedback/mine')
      .set({
        'x-dev-role': 'RECEPTIONIST',
        'x-dev-user-id': String(receptionistId),
      })
      .expect(403);
    await http().get('/api/v1/feedback/mine').expect(401);
  });

  it('saves feedback for a completed stay of the customer', async () => {
    const booking = await stay(customerId);
    const { body } = await submit({
      bookingId: String(booking._id),
      rating: 5,
      content: '  Phòng sạch, nhân viên thân thiện  ',
    }).expect(201);
    expect(body).toMatchObject({
      bookingId: String(booking._id),
      rating: 5,
      content: 'Phòng sạch, nhân viên thân thiện',
    });
    expect(body.id).toBeDefined();
    expect(body.createdAt).toBeDefined();
    const saved = await feedback.findOne({ booking: booking._id }).lean();
    expect(String(saved?.customer)).toBe(String(customerId));
    expect(saved?.reply).toBeUndefined();
  });

  it('does not need a rating', async () => {
    const booking = await stay(customerId);
    const { body } = await submit({
      bookingId: String(booking._id),
      content: 'Không đánh giá sao',
    }).expect(201);
    expect(body.rating).toBeUndefined();
  });

  it('accepts only one feedback per stay', async () => {
    const booking = await stay(customerId);
    await submit({ bookingId: String(booking._id), content: 'Lần một' }).expect(
      201,
    );
    await submit({ bookingId: String(booking._id), content: 'Lần hai' }).expect(
      409,
    );
    expect(await feedback.countDocuments({ booking: booking._id })).toBe(1);
  });

  it('lets only one of two simultaneous submissions through', async () => {
    const booking = await stay(customerId);
    const results = await Promise.all([
      submit({ bookingId: String(booking._id), content: 'Một' }),
      submit({ bookingId: String(booking._id), content: 'Hai' }),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
    expect(await feedback.countDocuments({ booking: booking._id })).toBe(1);
  });

  it("refuses another customer's stay and stays without an account", async () => {
    const others = await stay(otherId);
    const guest = await stay(undefined);
    await submit({
      bookingId: String(others._id),
      content: 'Của người khác',
    }).expect(403);
    await submit({
      bookingId: String(guest._id),
      content: 'Khách vãng lai',
    }).expect(403);
    expect(
      await feedback.countDocuments({
        booking: { $in: [others._id, guest._id] },
      }),
    ).toBe(0);
  });

  it('only takes feedback after check-out', async () => {
    for (const status of [
      BookingStatus.PendingDeposit,
      BookingStatus.Confirmed,
      BookingStatus.CheckedIn,
      BookingStatus.Cancelled,
    ]) {
      const booking = await stay(customerId, { status });
      const { body } = await submit({
        bookingId: String(booking._id),
        content: 'Quá sớm',
      }).expect(409);
      expect(body.message).toMatch(/check-out|checked out/i);
    }
    expect(await feedback.countDocuments({ customer: customerId })).toBe(0);
  });

  it('validates the request', async () => {
    const booking = await stay(customerId);
    const bookingId = String(booking._id);
    const bad: Record<string, unknown>[] = [
      { bookingId, rating: 0, content: 'x' },
      { bookingId, rating: 6, content: 'x' },
      { bookingId, rating: 1.5, content: 'x' },
      { bookingId, rating: 'five', content: 'x' },
      { bookingId, content: '' },
      { bookingId, content: '   ' },
      { bookingId, content: 'x'.repeat(2001) },
      { bookingId },
      { content: 'Thiếu booking' },
      { bookingId: 'not-an-id', content: 'x' },
      { bookingId, content: 'x', extra: true },
    ];
    for (const body of bad) {
      await submit(body).expect(400);
    }
    await submit({
      bookingId: String(new Types.ObjectId()),
      content: 'Không có',
    }).expect(404);
    expect(await feedback.countDocuments({ customer: customerId })).toBe(0);
  });

  it('lists only my completed stays with the feedback and the reply', async () => {
    const replied = await stay(customerId, { checkOut: '2097-06-14' });
    const sent = await stay(customerId, { checkOut: '2097-06-13' });
    const waiting = await stay(customerId, { checkOut: '2097-06-12' });
    await stay(customerId, { status: BookingStatus.Confirmed });
    await stay(otherId);
    const repliedAt = new Date('2097-06-20T03:00:00Z');
    await feedback.create([
      {
        customer: customerId,
        booking: replied._id,
        rating: 5,
        content: 'Tuyệt vời',
        reply: {
          content: 'Cảm ơn anh/chị',
          repliedBy: receptionistId,
          repliedAt,
        },
      },
      { customer: customerId, booking: sent._id, content: 'Ổn' },
    ]);

    const { body } = await mine().expect(200);
    expect(
      body.items.map((item: { bookingId: string }) => item.bookingId),
    ).toEqual([String(replied._id), String(sent._id), String(waiting._id)]);
    expect(body.items[0]).toMatchObject({
      code: replied.code,
      checkIn: vn('2097-06-10').toISOString(),
      checkOut: vn('2097-06-14').toISOString(),
      feedback: {
        rating: 5,
        content: 'Tuyệt vời',
        reply: {
          content: 'Cảm ơn anh/chị',
          repliedAt: repliedAt.toISOString(),
        },
      },
    });
    expect(body.items[1].feedback).toMatchObject({ content: 'Ổn' });
    expect(body.items[1].feedback.reply).toBeUndefined();
    expect(body.items[2].feedback).toBeNull();
  });

  it('lists nothing for a customer without completed stays', async () => {
    await stay(customerId, { status: BookingStatus.CheckedIn });
    const { body } = await mine().expect(200);
    expect(body.items).toEqual([]);
  });
});
