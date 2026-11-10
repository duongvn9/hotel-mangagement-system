import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Booking, BookingSchema } from '../bookings/schemas/booking.schema.js';
import { TasksModule } from '../tasks/tasks.module.js';
import { User, UserSchema } from '../users/schemas/user.schema.js';
import {
  CheckoutInspectionController,
  InspectorsController,
} from './checkout-inspection.controller.js';
import { CheckoutInspectionService } from './checkout-inspection.service.js';

/** Yêu cầu nhân viên dịch vụ kiểm tra phòng khi trả phòng; tách riêng khỏi InvoicesModule. */
@Module({
  imports: [
    TasksModule,
    MongooseModule.forFeature([
      { name: Booking.name, schema: BookingSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [CheckoutInspectionController, InspectorsController],
  providers: [CheckoutInspectionService],
})
export class CheckoutInspectionModule {}
