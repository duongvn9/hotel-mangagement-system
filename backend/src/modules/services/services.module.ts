import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AssetImagesService } from '../../common/asset-images.service.js';
import { MongooseModule } from '@nestjs/mongoose';
import { Service, ServiceSchema } from './schemas/service.schema.js';
import { ServicesController } from './services.controller.js';
import { ServicesService } from './services.service.js';
@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([{ name: Service.name, schema: ServiceSchema }]),
  ],
  controllers: [ServicesController],
  providers: [ServicesService, AssetImagesService],
  exports: [MongooseModule, ServicesService],
})
export class ServicesModule {}
