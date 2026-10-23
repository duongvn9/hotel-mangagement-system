import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Booking, BookingSchema } from './schemas/booking.schema.js';
import { RoomHold, RoomHoldSchema } from './schemas/room-hold.schema.js';
import { AvailabilityService } from './availability.service.js';
import { AvailabilityClock, AvailabilityRoomSource, UnconfiguredAvailabilityRoomSource } from './availability.adapters.js';

@Module({
  imports: [MongooseModule.forFeature([
    { name: Booking.name, schema: BookingSchema },
    { name: RoomHold.name, schema: RoomHoldSchema },
  ])],
  providers: [AvailabilityService, AvailabilityClock, { provide: AvailabilityRoomSource, useClass: UnconfiguredAvailabilityRoomSource }],
  exports: [MongooseModule, AvailabilityService, AvailabilityRoomSource, AvailabilityClock],
})
export class BookingsModule {}
