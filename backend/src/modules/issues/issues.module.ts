import { Module } from '@nestjs/common';
import { ServiceTaskIssuesController } from './service-task-issues.controller.js';
import { Task, TaskSchema } from '../tasks/schemas/task.schema.js';
import {
  ServiceOrder,
  ServiceOrderSchema,
} from '../service-orders/schemas/service-order.schema.js';
import { Service, ServiceSchema } from '../services/schemas/service.schema.js';
import { ServiceTaskIssuesService } from './service-task-issues.service.js';
import { MongooseModule } from '@nestjs/mongoose';
import { BookingsModule } from '../bookings/bookings.module.js';
import { RoomsModule } from '../rooms/rooms.module.js';
import { TasksModule } from '../tasks/tasks.module.js';
import { User, UserSchema } from '../users/schemas/user.schema.js';
import { IssueContextAdapter } from './issue-context.adapter.js';
import { IssuesController } from './issues.controller.js';
import { IssuesService } from './issues.service.js';
import { Issue, IssueSchema } from './schemas/issue.schema.js';

@Module({
  imports: [
    BookingsModule,
    RoomsModule,
    TasksModule,
    MongooseModule.forFeature([
      { name: Issue.name, schema: IssueSchema },
      { name: Task.name, schema: TaskSchema },
      { name: ServiceOrder.name, schema: ServiceOrderSchema },
      { name: Service.name, schema: ServiceSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [ServiceTaskIssuesController, IssuesController],
  providers: [IssuesService, IssueContextAdapter, ServiceTaskIssuesService],
})
export class IssuesModule {}
