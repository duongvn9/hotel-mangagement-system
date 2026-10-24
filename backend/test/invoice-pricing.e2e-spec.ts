import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import type { INestApplication } from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { AppModule } from '../src/app.module.js';
import { InvoicesService } from '../src/modules/invoices/invoices.service.js';
import { Booking } from '../src/modules/bookings/schemas/booking.schema.js';
import { Invoice } from '../src/modules/invoices/schemas/invoice.schema.js';
import { Room } from '../src/modules/rooms/schemas/room.schema.js';
import { RoomType } from '../src/modules/room-types/schemas/room-type.schema.js';
import { PaymentTransaction } from '../src/modules/payments/schemas/payment-transaction.schema.js';

// H7 pricing thật từ RoomType.basePrice qua RoomTypePricingAdapter (không override).
describe('Invoice pricing from RoomType (e2e)', () => {
  let app: INestApplication;
  let service: InvoicesService;
  let rooms: Model<Room>;
  let roomTypes: Model<RoomType>;
  let bookings: Model<Booking>;
  let invoices: Model<Invoice>;
  let payments: Model<PaymentTransaction>;
  const typeId = new Types.ObjectId();
  const roomA = new Types.ObjectId();
  const roomB = new Types.ObjectId();
  const bookingId = new Types.ObjectId();

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    await app.init();
    service = app.get(InvoicesService);
    rooms = app.get(getModelToken(Room.name));
    roomTypes = app.get(getModelToken(RoomType.name));
    bookings = app.get(getModelToken(Booking.name));
    invoices = app.get(getModelToken(Invoice.name));
    payments = app.get(getModelToken(PaymentTransaction.name));
    await Promise.all([
      rooms.init(),
      roomTypes.init(),
      bookings.init(),
      invoices.init(),
      payments.init(),
    ]);

    await roomTypes.create({
      _id: typeId,
      name: `PRICE Deluxe ${typeId}`,
      adultCapacity: 2,
      childCapacity: 1,
      basePrice: 800000,
    });
    await rooms.create([
      {
        _id: roomA,
        roomNumber: `PR-A-${roomA}`,
        floor: 2,
        roomType: typeId,
        status: 'AVAILABLE',
      },
      {
        _id: roomB,
        roomNumber: `PR-B-${roomB}`,
        floor: 2,
        roomType: typeId,
        status: 'AVAILABLE',
      },
    ]);
    await bookings.create({
      _id: bookingId,
      code: `PRICE-${bookingId}`,
      rooms: [roomA, roomB],
      guestName: 'Pricing test',
      guestEmail: 'price@example.test',
      guestPhone: '0900000000',
      checkIn: new Date('2090-03-01T00:00:00+07:00'),
      checkOut: new Date('2090-03-04T00:00:00+07:00'),
      guests: 2,
      status: 'CONFIRMED',
      roomTotal: 0,
      depositAmount: 500000,
    });
  });

  afterAll(async () => {
    await payments.deleteMany({ booking: bookingId });
    await invoices.deleteMany({ booking: bookingId });
    await bookings.deleteOne({ _id: bookingId });
    await rooms.deleteMany({ _id: { $in: [roomA, roomB] } });
    await roomTypes.deleteOne({ _id: typeId });
    await app.close();
  });

  it('prices two rooms for three nights from the room type base price', async () => {
    const invoice = await service.getOrCreateForBooking(String(bookingId));
    // 2 phòng x 3 đêm x 800.000 = 4.800.000
    expect(invoice.roomTotal).toBe(4800000);
    expect(invoice.totalAmount).toBe(4800000);
    expect(invoice.balanceDue).toBe(4800000);
  });

  it('prefers the booking rate snapshot over the current room type price', async () => {
    const snapBooking = new Types.ObjectId();
    const snapRoom = new Types.ObjectId();
    await rooms.create({
      _id: snapRoom,
      roomNumber: `PR-S-${snapRoom}`,
      floor: 3,
      roomType: typeId,
      status: 'AVAILABLE',
    });
    // Snapshot chốt 500.000/đêm dù RoomType hiện tại là 800.000.
    await bookings.create({
      _id: snapBooking,
      code: `PRICE-SNAP-${snapBooking}`,
      rooms: [snapRoom],
      guestName: 'Snapshot test',
      guestEmail: 'snap@example.test',
      guestPhone: '0900000000',
      checkIn: new Date('2090-04-01T00:00:00+07:00'),
      checkOut: new Date('2090-04-03T00:00:00+07:00'),
      guests: 1,
      status: 'CONFIRMED',
      roomTotal: 1000000,
      depositAmount: 300000,
      rateSnapshot: [{ room: snapRoom, ratePerNight: 500000 }],
    });
    try {
      const invoice = await service.getOrCreateForBooking(String(snapBooking));
      // 1 phòng x 2 đêm x 500.000 (snapshot) = 1.000.000, không phải 1.600.000.
      expect(invoice.roomTotal).toBe(1000000);
    } finally {
      await invoices.deleteMany({ booking: snapBooking });
      await bookings.deleteOne({ _id: snapBooking });
      await rooms.deleteOne({ _id: snapRoom });
    }
  });
});
