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
import { Task, TaskSchema } from '../tasks/schemas/task.schema.js';
import { MaintenanceHistoryService } from './maintenance-history.service.js';
import { MaintenanceHistoryController } from './maintenance-history.controller.js';

@Module({
  imports: [
    EquipmentModule,
    RoomsModule,
    TasksModule,
    MongooseModule.forFeature([
      { name: Maintenance.name, schema: MaintenanceSchema },
      { name: User.name, schema: UserSchema },
      // TasksModule exports only its service; reuse the authoritative schema for read-only aggregation.
      { name: Task.name, schema: TaskSchema },
    ]),
  ],
  controllers: [MaintenanceController, MaintenanceHistoryController],
  providers: [MaintenanceService, MaintenanceHistoryService],
  exports: [MaintenanceService, MongooseModule],
})
export class MaintenanceModule {}
