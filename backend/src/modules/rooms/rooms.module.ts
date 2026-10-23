import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RoomTypesModule } from '../room-types/room-types.module.js';
import { Room, RoomSchema } from './schemas/room.schema.js';
import { RoomsController } from './rooms.controller.js';
import { RoomsService } from './rooms.service.js';

@Module({
  imports: [
    RoomTypesModule,
    MongooseModule.forFeature([{ name: Room.name, schema: RoomSchema }]),
  ],
  controllers: [RoomsController],
  providers: [RoomsService],
  exports: [MongooseModule, RoomsService],
})
export class RoomsModule {}
