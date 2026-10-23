import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Amenity, AmenitySchema } from './schemas/amenity.schema.js';
import { AmenitiesService } from './amenities.service.js';
import { AmenitiesController } from './amenities.controller.js';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Amenity.name, schema: AmenitySchema }]),
  ],
  controllers: [AmenitiesController],
  providers: [AmenitiesService],
  exports: [MongooseModule, AmenitiesService],
})
export class AmenitiesModule {}
