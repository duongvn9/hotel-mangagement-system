import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { EquipmentModule } from '../equipment/equipment.module.js';
import { RoomsModule } from '../rooms/rooms.module.js';
import { TasksModule } from '../tasks/tasks.module.js';
import { User, UserSchema } from '../users/schemas/user.schema.js';
import {
  Maintenance,
  MaintenanceSchema,
} from './schemas/maintenance.schema.js';
import { MaintenanceService } from './maintenance.service.js';
import { MaintenanceController } from './maintenance.controller.js';

@Module({
  imports: [
    EquipmentModule,
    RoomsModule,
    TasksModule,
    MongooseModule.forFeature([
      { name: Maintenance.name, schema: MaintenanceSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [MaintenanceController],
  providers: [MaintenanceService],
  exports: [MaintenanceService, MongooseModule],
})
export class MaintenanceModule {}
