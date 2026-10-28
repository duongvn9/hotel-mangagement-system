import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import type { INestApplication } from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { AppModule } from '../src/app.module.js';
import {
  AvailabilityClock,
  AvailabilityRoomSource,
} from '../src/modules/bookings/availability.adapters.js';
import { AvailabilityService } from '../src/modules/bookings/availability.service.js';
import {
  Booking,
  BookingStatus,
} from '../src/modules/bookings/schemas/booking.schema.js';
import { RoomHold } from '../src/modules/bookings/schemas/room-hold.schema.js';
import { normalizeStay } from '../src/modules/bookings/availability.core.js';

describe('H6 real booking and hold queries', () => {
  let app: INestApplication;
  let service: AvailabilityService;
  let bookings: Model<Booking>;
  let holds: Model<RoomHold>;
  const id = new Types.ObjectId();
  const roomIds = [new Types.ObjectId(), new Types.ObjectId()];
  const query = { checkIn: '2090-10-23', checkOut: '2090-10-25', guests: 2 };
  const now = new Date('2090-10-20T00:00:00Z');
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AvailabilityRoomSource)
      .useValue({
        findCandidates: async () =>
          roomIds.map((room) => ({
            id: String(room),
            roomTypeId: String(id),
            capacity: 2,
            isActive: true,
            roomTypeActive: true,
            operationallyAvailable: true,
          })),
      })
      .overrideProvider(AvailabilityClock)
      .useValue({ now: () => now })
      .compile();
    app = module.createNestApplication();
    await app.init();
    service = app.get(AvailabilityService);
    bookings = app.get(getModelToken(Booking.name));
    holds = app.get(getModelToken(RoomHold.name));
    await bookings.create({
      _id: id,
      code: `H6-${id}`,
      rooms: roomIds,
      guestName: 'H6',
      guestEmail: 'h6@example.test',
      guestPhone: '0900000000',
      ...normalizeStay(query),
      adultCount: 2,
      roomTotal: 0,
      depositAmount: 0,
      status: BookingStatus.PendingDeposit,
    });
  });
  afterAll(async () => {
    await holds.deleteMany({ booking: id });
    await bookings.deleteOne({ _id: id });
    await app.close();
  });
  it('handles pending, active/expired persisted holds, terminal parents, multiroom and adjacency', async () => {
    expect(await service.findAvailableRooms(query)).toHaveLength(2);
    await holds.create({
      booking: id,
      holdToken: 'AVAIL-HOLD-TOKEN-1',
      rooms: roomIds,
      ...normalizeStay(query),
      expiresAt: new Date('2090-10-21T00:00:00Z'),
    });
    expect(await service.findAvailableRooms(query)).toEqual([]);
    await holds.updateOne({ booking: id }, { expiresAt: now });
    expect(await holds.countDocuments({ booking: id })).toBe(1);
    expect(await service.findAvailableRooms(query)).toHaveLength(2);
    await holds.updateOne(
      { booking: id },
      { expiresAt: new Date('2090-10-21T00:00:00Z'), isActive: false },
    );
    expect(await service.findAvailableRooms(query)).toHaveLength(2);
    await holds.updateOne({ booking: id }, { isActive: true });
    await bookings.updateOne({ _id: id }, { status: BookingStatus.Cancelled });
    expect(await service.findAvailableRooms(query)).toHaveLength(2);
    await bookings.updateOne({ _id: id }, { status: BookingStatus.Confirmed });
    expect(await service.findAvailableRooms(query)).toEqual([]);
    expect(
      await service.findAvailableRooms({
        ...query,
        checkIn: '2090-10-25',
        checkOut: '2090-10-26',
      }),
    ).toHaveLength(2);
    await bookings.deleteOne({ _id: id });
    expect(await service.findAvailableRooms(query)).toEqual([]);
  });
});
