import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Booking, BookingSchema } from './schemas/booking.schema.js';
import { RoomHold, RoomHoldSchema } from './schemas/room-hold.schema.js';

@Module({
  imports: [MongooseModule.forFeature([
    { name: Booking.name, schema: BookingSchema },
    { name: RoomHold.name, schema: RoomHoldSchema },
  ])],
  exports: [MongooseModule],
})
export class BookingsModule {}
