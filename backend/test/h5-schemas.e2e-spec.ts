import { Test } from '@nestjs/testing';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import type { INestApplication } from '@nestjs/common';
import { Connection, Model, Types } from 'mongoose';
import { AppModule } from '../src/app.module.js';
import { Booking } from '../src/modules/bookings/schemas/booking.schema.js';
import { RoomHold } from '../src/modules/bookings/schemas/room-hold.schema.js';
import { Invoice } from '../src/modules/invoices/schemas/invoice.schema.js';
import { PaymentTransaction } from '../src/modules/payments/schemas/payment-transaction.schema.js';
import { seedBookings } from '../src/modules/bookings/seed.js';
import { User } from '../src/modules/users/schemas/user.schema.js';
import { RoomType } from '../src/modules/room-types/schemas/room-type.schema.js';
import { Room } from '../src/modules/rooms/schemas/room.schema.js';
import { toBusinessDate } from '../src/common/database/conventions.js';

describe('H5 persistence (e2e)', () => {
  let app: INestApplication;
  let connection: Connection;
  let bookings: Model<Booking>;
  let holds: Model<RoomHold>;
  let invoices: Model<Invoice>;
  let payments: Model<PaymentTransaction>;
  const roomId = new Types.ObjectId();
  const bookingId = new Types.ObjectId();
  const code = `H5-E2E-${bookingId}`;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    await app.init();
    connection = app.get(getConnectionToken());
    bookings = app.get(getModelToken(Booking.name));
    holds = app.get(getModelToken(RoomHold.name));
    invoices = app.get(getModelToken(Invoice.name));
    payments = app.get(getModelToken(PaymentTransaction.name));
    await Promise.all([
      bookings.init(),
      holds.init(),
      invoices.init(),
      payments.init(),
    ]);
  });

  afterAll(async () => {
    await payments.deleteMany({ booking: bookingId });
    await invoices.deleteMany({ booking: bookingId });
    await holds.deleteMany({ booking: bookingId });
    await bookings.deleteMany({ code });
    await connection.collection('rooms').deleteOne({ _id: roomId });
    await app.close();
  });

  it('persists UTC timestamps and enforces booking/invoice/transaction unique indexes', async () => {
    const data = {
      _id: bookingId,
      code,
      guestName: 'H5',
      guestEmail: 'h5@example.test',
      guestPhone: '0900000000',
      rooms: [roomId, new Types.ObjectId()],
      checkIn: new Date('2026-10-23T07:00:00Z'),
      checkOut: new Date('2026-10-24T05:00:00Z'),
      adultCount: 2,
      roomTotal: 0,
      depositAmount: 0,
    };
    const saved = await bookings.create(data);
    expect(saved.toObject()).toMatchObject({
      createdAt: expect.any(Date),
      updatedAt: expect.any(Date),
    });
    await expect(
      bookings.create({ ...data, _id: new Types.ObjectId() }),
    ).rejects.toMatchObject({ code: 11000 });
    const invoice = await invoices.create({ booking: bookingId, code });
    await expect(
      invoices.create({ booking: bookingId, code: `${code}-2` }),
    ).rejects.toMatchObject({ code: 11000 });
    const payment = {
      booking: bookingId,
      invoice: invoice._id,
      transactionRef: code,
      providerTransactionRef: code,
      method: 'VNPAY',
      purpose: 'DEPOSIT',
      status: 'SUCCESS',
      amount: 0,
    };
    await payments.create(payment);
    await expect(
      payments.create({ ...payment, providerTransactionRef: `${code}-2` }),
    ).rejects.toMatchObject({ code: 11000 });
    await expect(
      payments.create({ ...payment, transactionRef: `${code}-2` }),
    ).rejects.toMatchObject({ code: 11000 });
    await payments.create([
      {
        ...payment,
        transactionRef: `${code}-3`,
        providerTransactionRef: undefined,
      },
      {
        ...payment,
        transactionRef: `${code}-4`,
        providerTransactionRef: undefined,
      },
    ]);
  });

  it('keeps the legacy lookup index alongside named uniqueness for active pending payments only', async () => {
    await payments.collection.createIndex({ booking: 1, purpose: 1 });
    const indexes = await payments.collection.indexes();
    expect(
      indexes.find((index) => index.name === 'booking_1_purpose_1'),
    ).toMatchObject({
      key: { booking: 1, purpose: 1 },
    });
    expect(
      indexes.find((index) => index.name === 'booking_1_purpose_1')?.unique,
    ).not.toBe(true);
    expect(
      indexes.find(
        (index) =>
          index.name === 'unique_active_pending_payment_per_booking_purpose',
      ),
    ).toMatchObject({
      key: { booking: 1, purpose: 1 },
      unique: true,
      partialFilterExpression: { status: 'PENDING', isActive: true },
    });
    const invoice = await invoices.findOne({ booking: bookingId }).orFail();
    let sequence = 0;
    const create = (extra = {}) =>
      payments.create({
        booking: bookingId,
        invoice: invoice._id,
        transactionRef: `${code}-pending-${++sequence}`,
        method: 'VNPAY',
        purpose: 'DEPOSIT',
        amount: 1,
        ...extra,
      });
    const attempts = await Promise.allSettled([create(), create()]);
    expect(
      attempts.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      attempts.find((result) => result.status === 'rejected'),
    ).toMatchObject({ reason: { code: 11000 } });
    await create({ purpose: 'FINAL' });
    await create({ booking: new Types.ObjectId() });
    await create({ isActive: false });
    await create({ isActive: false });
    for (const status of ['SUCCESS', 'FAILED', 'CANCELLED']) {
      await create({ status });
      await create({ status });
    }
    await payments.updateOne(
      {
        booking: bookingId,
        purpose: 'DEPOSIT',
        status: 'PENDING',
        isActive: true,
      },
      { $set: { status: 'FAILED' } },
    );
    await create();
    await payments.deleteMany({
      transactionRef: new RegExp(`^${code}-pending-`),
    });
  });

  it('excludes expired holds from availability without a TTL index', async () => {
    const data = {
      booking: bookingId,
      holdToken: 'H5-HOLD-TOKEN-0001',
      rooms: [roomId],
      checkIn: new Date('2026-10-23'),
      checkOut: new Date('2026-10-24'),
      expiresAt: new Date(Date.now() + 60000),
    };
    await holds.create(data);
    await expect(holds.create(data)).rejects.toMatchObject({ code: 11000 });
    expect(
      await holds.countDocuments({
        booking: bookingId,
        isActive: true,
        expiresAt: { $gt: new Date() },
      }),
    ).toBe(1);
    await holds.updateOne({ booking: bookingId }, { expiresAt: new Date(0) });
    expect(
      await holds.countDocuments({
        booking: bookingId,
        isActive: true,
        expiresAt: { $gt: new Date() },
      }),
    ).toBe(0);
    // TTL tự xoá đã bỏ: backend chủ động nhả hold quá hạn (sweep + lazy expire).
    expect(
      (await holds.collection.indexes()).some(
        (index) => index.key.expiresAt === 1 && index.expireAfterSeconds === 0,
      ),
    ).toBe(false);
  });

  it('skips absent dependencies and seeds idempotently without overwriting edits', async () => {
    const users = app.get<Model<User>>(getModelToken(User.name));
    const types = app.get<Model<RoomType>>(getModelToken(RoomType.name));
    const rooms = app.get<Model<Room>>(getModelToken(Room.name));
    const seededCount = () =>
      bookings.countDocuments({ code: 'SEED-CHECKED-IN-001' });
    // Dọn dữ liệu mẫu do e2e khác để lại (phòng 101 có thể đã bị khoá).
    await bookings.deleteMany({ code: /^SEED-/ });
    await rooms.deleteOne({ roomNumber: '101' });
    await users.deleteOne({ email: 'customer@hms.local' });
    expect(await seededCount()).toBe(0);
    await seedBookings(app);
    expect(await seededCount()).toBe(0);
    const roomType = await types.create({
      name: `H5-E2E-Type-${roomId}`,
      adultCapacity: 2,
      childCapacity: 0,
      basePrice: 700000,
    });
    await rooms.create({
      _id: roomId,
      roomNumber: '101',
      floor: 1,
      roomType: roomType._id,
    });
    await seedBookings(app);
    expect(await seededCount()).toBe(0);
    const user = await users.create({
      email: 'customer@hms.local',
      fullName: 'Seed H5',
      role: 'CUSTOMER',
    });
    try {
      await seedBookings(app);
      const sample = await bookings
        .findOne({ code: 'SEED-CHECKED-IN-001' })
        .orFail();
      const rate = 700000;
      expect(sample.status).toBe('CHECKED_IN');
      expect(String(sample.customer)).toBe(String(user._id));
      expect(sample.rooms.map(String)).toEqual([String(roomId)]);
      expect(sample.roomTotal).toBe(rate * 2);
      expect(sample.depositAmount).toBe(Math.round(rate * 2 * 0.3));
      expect(
        sample.rateSnapshot.map(({ room, ratePerNight }) => ({
          room: String(room),
          ratePerNight,
        })),
      ).toEqual([{ room: String(roomId), ratePerNight: rate }]);
      expect(toBusinessDate(sample.checkIn)).toBe(toBusinessDate());
      await bookings.updateOne({ _id: sample._id }, { guestName: 'Edited' });
      await seedBookings(app);
      expect(await bookings.countDocuments({ code: sample.code })).toBe(1);
      expect((await bookings.findById(sample._id).orFail()).guestName).toBe(
        'Edited',
      );
    } finally {
      await bookings.deleteMany({ code: /^SEED-/, customer: user._id });
      await users.deleteOne({ _id: user._id });
      await rooms.deleteOne({ _id: roomId });
      await types.deleteOne({ _id: roomType._id });
    }
  });
});
