import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Service, ServiceSchema } from './schemas/service.schema.js';
import { ServicesController } from './services.controller.js';
import { ServicesService } from './services.service.js';
@Module({
  imports: [
    MongooseModule.forFeature([{ name: Service.name, schema: ServiceSchema }]),
  ],
  controllers: [ServicesController],
  providers: [ServicesService],
  exports: [MongooseModule, ServicesService],
})
export class ServicesModule {}
