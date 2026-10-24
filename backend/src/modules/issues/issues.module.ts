import { Module } from '@nestjs/common';
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
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [IssuesController],
  providers: [IssuesService, IssueContextAdapter],
})
export class IssuesModule {}
