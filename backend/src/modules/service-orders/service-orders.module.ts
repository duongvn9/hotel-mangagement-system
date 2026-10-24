import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BookingsModule } from '../bookings/bookings.module.js';
import { ServicesModule } from '../services/services.module.js';
import {
  ServiceOrder,
  ServiceOrderSchema,
} from './schemas/service-order.schema.js';
import { ServiceOrdersController } from './service-orders.controller.js';
import { ServiceOrdersService } from './service-orders.service.js';

@Module({
  imports: [
    BookingsModule,
    ServicesModule,
    MongooseModule.forFeature([
      { name: ServiceOrder.name, schema: ServiceOrderSchema },
    ]),
  ],
  controllers: [ServiceOrdersController],
  providers: [ServiceOrdersService],
  exports: [MongooseModule, ServiceOrdersService],
})
export class ServiceOrdersModule {}
