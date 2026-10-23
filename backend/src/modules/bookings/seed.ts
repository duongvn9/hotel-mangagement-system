import { Logger } from '@nestjs/common';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { type Connection, type Model, Types } from 'mongoose';
import type { Seed } from '../../database/seed.js';
import { User } from '../users/schemas/user.schema.js';
import { Booking, BookingStatus } from './schemas/booking.schema.js';

export const seedBookings: Seed = async (app) => {
  const users = app.get<Model<User>>(getModelToken(User.name));
  const bookings = app.get<Model<Booking>>(getModelToken(Booking.name));
  const connection = app.get<Connection>(getConnectionToken());
  const customer = await users
    .findOne({ email: 'customer@hms.local', isActive: true })
    .lean();
  const room = await connection.collection('rooms').findOne({ isActive: true });
  if (!customer || !room || !(room._id instanceof Types.ObjectId)) {
    Logger.log(
      'Skipping bookings: an active sample customer and Room are required',
      'Seed',
    );
    return;
  }
  const sample = new bookings({
    code: 'SEED-CHECKED-IN-001',
    customer: customer._id,
    guestName: customer.fullName,
    guestEmail: customer.email,
    guestPhone: customer.phone || '0900000000',
    rooms: [room._id],
    checkIn: new Date('2026-10-23T07:00:00.000Z'),
    checkOut: new Date('2026-10-25T05:00:00.000Z'),
    checkedInAt: new Date('2026-10-23T07:00:00.000Z'),
    guests: 1,
    status: BookingStatus.CheckedIn,
    roomTotal: 2000000,
    depositAmount: 1000000,
  });
  await sample.validate();
  const { _id, ...data } = sample.toObject();
  await bookings.updateOne(
    { code: sample.code },
    { $setOnInsert: data },
    { upsert: true },
  );
};
