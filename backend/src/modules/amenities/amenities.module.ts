import { Module } from '@nestjs/common';
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
    MongooseModule.forFeature([
      { name: Amenity.name, schema: AmenitySchema },
      { name: RoomType.name, schema: RoomTypeSchema },
    ]),
  ],
  controllers: [AmenitiesController],
  providers: [AmenitiesService],
  exports: [MongooseModule, AmenitiesService],
})
export class AmenitiesModule {}
