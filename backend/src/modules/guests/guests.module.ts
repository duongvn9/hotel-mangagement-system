import { Module } from '@nestjs/common';
import { BookingsModule } from '../bookings/bookings.module.js';
import { GuestsController } from './guests.controller.js';
import { GuestsService } from './guests.service.js';

@Module({
  imports: [BookingsModule],
  controllers: [GuestsController],
  providers: [GuestsService],
})
export class GuestsModule {}
