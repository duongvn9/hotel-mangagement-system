import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AssetImagesService } from '../../common/asset-images.service.js';
import { MongooseModule } from '@nestjs/mongoose';
import {
  RoomType,
  RoomTypeSchema,
} from '../room-types/schemas/room-type.schema.js';
import { Amenity, AmenitySchema } from './schemas/amenity.schema.js';
import { AmenitiesService } from './amenities.service.js';
import { AmenitiesController } from './amenities.controller.js';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: Amenity.name, schema: AmenitySchema },
      { name: RoomType.name, schema: RoomTypeSchema },
    ]),
  ],
  controllers: [AmenitiesController],
  providers: [AmenitiesService, AssetImagesService],
  exports: [MongooseModule, AmenitiesService],
})
export class AmenitiesModule {}
