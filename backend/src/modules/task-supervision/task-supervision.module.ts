import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Task, TaskSchema } from '../tasks/schemas/task.schema.js';
import { User, UserSchema } from '../users/schemas/user.schema.js';
import {
  Maintenance,
  MaintenanceSchema,
} from '../maintenance/schemas/maintenance.schema.js';
import { TaskSupervisionService } from './task-supervision.service.js';
import { TaskSupervisionController } from './task-supervision.controller.js';
import { TaskSupervisionClock } from './task-supervision.clock.js';

@Module({
  // Reuse authoritative schemas for reads. No dependency on TasksModule or its write service.
  imports: [
    MongooseModule.forFeature([
      { name: Task.name, schema: TaskSchema },
      { name: User.name, schema: UserSchema },
      { name: Maintenance.name, schema: MaintenanceSchema },
    ]),
  ],
  controllers: [TaskSupervisionController],
  providers: [TaskSupervisionService, TaskSupervisionClock],
  exports: [TaskSupervisionService],
})
export class TaskSupervisionModule {}
