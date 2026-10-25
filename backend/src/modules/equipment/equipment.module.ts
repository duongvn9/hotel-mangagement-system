import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Equipment, EquipmentSchema } from './schemas/equipment.schema.js';
import { EquipmentService } from './equipment.service.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Equipment.name, schema: EquipmentSchema },
    ]),
  ],
  providers: [EquipmentService],
  exports: [EquipmentService, MongooseModule],
})
export class EquipmentModule {}
