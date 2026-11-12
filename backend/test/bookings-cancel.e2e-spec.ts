import { VersioningType, type INestApplication } from '@nestjs/common';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { Connection, Model, Types } from 'mongoose';
import request from 'supertest';
import { vi } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { Booking } from '../src/modules/bookings/schemas/booking.schema.js';
import { RoomHold } from '../src/modules/bookings/schemas/room-hold.schema.js';
import { Room } from '../src/modules/rooms/schemas/room.schema.js';
import { RoomType } from '../src/modules/room-types/schemas/room-type.schema.js';
import { NotificationsService } from '../src/modules/notifications/notifications.service.js';
import { NOTIFICATION_TRANSPORT } from '../src/modules/notifications/notification.types.js';
import { assertTestDatabase } from './test-database.js';
import {
  NotificationLog,
  NotificationLogSchema,
} from '../src/modules/notifications/schemas/notification-log.schema.js';

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

  let notificationLogs: Model<NotificationLog>;
  const clean = async () => {
    const existing = await bookings
      .find({ rooms: { $in: [roomId] } })
      .select('_id')
      .lean();
    const ids = existing.map((booking) => booking._id);
    await Promise.all([
      bookings.deleteMany({ _id: { $in: ids } }),
      holds.deleteMany({ booking: { $in: ids } }),
      notificationLogs.deleteMany({ relatedBookingId: { $in: ids } }),
    ]);
  };

  beforeAll(async () => {
    assertTestDatabase(process.env.MONGODB_URI);
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    await app.init();
    bookings = app.get(getModelToken(Booking.name));
    holds = app.get(getModelToken(RoomHold.name));
    const connection = app.get<Connection>(getConnectionToken());
    notificationLogs = connection.models[NotificationLog.name]
      ? (connection.models[NotificationLog.name] as Model<NotificationLog>)
      : connection.model<NotificationLog>(
          NotificationLog.name,
          NotificationLogSchema,
        );
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
    await app.get(NotificationsService).drain();
    const smtpSend = vi
      .spyOn(app.get(NOTIFICATION_TRANSPORT), 'send')
      .mockImplementation(async (message) => {
        if (message.template === 'booking-cancelled')
          throw new Error('mock SMTP failure');
      });
    const res = await http()
      .post(`/api/v1/bookings/${created.body.id}/cancel`)
      .set(CUSTOMER)
      .send({})
      .expect(201);
    await vi.waitFor(() =>
      expect(smtpSend).toHaveBeenCalledWith(
        expect.objectContaining({ template: 'booking-cancelled' }),
        expect.any(AbortSignal),
      ),
    );
    await app.get(NotificationsService).drain();
    expect(smtpSend).toHaveBeenCalled();
    smtpSend.mockRestore();
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
