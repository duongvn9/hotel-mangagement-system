import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Booking, BookingSchema } from '../bookings/schemas/booking.schema.js';
import { User, UserSchema } from '../users/schemas/user.schema.js';
import { FeedbackController } from './feedback.controller.js';
import { FeedbackService } from './feedback.service.js';
import { Feedback, FeedbackSchema } from './schemas/feedback.schema.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Feedback.name, schema: FeedbackSchema },
      { name: User.name, schema: UserSchema },
      { name: Booking.name, schema: BookingSchema },
    ]),
  ],
  controllers: [FeedbackController],
  providers: [FeedbackService],
  exports: [MongooseModule],
})
export class FeedbackModule {}
