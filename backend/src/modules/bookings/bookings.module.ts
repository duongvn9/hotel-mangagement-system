import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RoomsModule } from '../rooms/rooms.module.js';
import { Booking, BookingSchema } from './schemas/booking.schema.js';
import { RoomHold, RoomHoldSchema } from './schemas/room-hold.schema.js';
import { AvailabilityController } from './availability.controller.js';
import { AvailabilityService } from './availability.service.js';
import { AvailabilityClock, AvailabilityRoomSource } from './availability.adapters.js';
import { MongoAvailabilityRoomSource } from './mongo-availability-room-source.js';

@Module({
  imports: [
    RoomsModule,
    MongooseModule.forFeature([
      { name: Booking.name, schema: BookingSchema },
      { name: RoomHold.name, schema: RoomHoldSchema },
    ]),
  ],
  controllers: [AvailabilityController],
  providers: [
    AvailabilityService,
    AvailabilityClock,
    {
      provide: AvailabilityRoomSource,
      useClass: MongoAvailabilityRoomSource,
    },
  ],
  exports: [
    MongooseModule,
    AvailabilityService,
    AvailabilityRoomSource,
    AvailabilityClock,
  ],
})
export class BookingsModule {}
