import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AmenitiesModule } from '../amenities/amenities.module.js';
import { RoomType, RoomTypeSchema } from './schemas/room-type.schema.js';
import { RoomTypesController } from './room-types.controller.js';
import { RoomTypesService } from './room-types.service.js';
import { RoomTypeImagesService } from './room-type-images.service.js';

@Module({
  imports: [
    AmenitiesModule,
    MongooseModule.forFeature([
      { name: RoomType.name, schema: RoomTypeSchema },
    ]),
  ],
  controllers: [RoomTypesController],
  providers: [RoomTypesService, RoomTypeImagesService],
  exports: [MongooseModule, RoomTypesService],
})
export class RoomTypesModule {}
