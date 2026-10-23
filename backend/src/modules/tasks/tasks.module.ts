import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RolesModule } from '../roles/roles.module.js';
import { UsersModule } from '../users/users.module.js';
import { Task, TaskSchema } from './schemas/task.schema.js';
import { TasksService } from './tasks.service.js';

@Module({
  imports: [UsersModule, RolesModule, MongooseModule.forFeature([
    { name: Task.name, schema: TaskSchema },
  ])],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}
