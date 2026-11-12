import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  RoomType,
  RoomTypeSchema,
} from '../room-types/schemas/room-type.schema.js';
import { BedType, BedTypeSchema } from './schemas/bed-type.schema.js';
import { BedTypesService } from './bed-types.service.js';
import { BedTypesController } from './bed-types.controller.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: BedType.name, schema: BedTypeSchema },
      { name: RoomType.name, schema: RoomTypeSchema },
    ]),
  ],
  controllers: [BedTypesController],
  providers: [BedTypesService],
  exports: [MongooseModule, BedTypesService],
})
export class BedTypesModule {}
