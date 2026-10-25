import { Module } from '@nestjs/common';
import { RoomsModule } from '../rooms/rooms.module.js';
import { TaskSupervisionModule } from '../task-supervision/task-supervision.module.js';
import { ReportsModule } from '../reports/reports.module.js';
import { DashboardController } from './dashboard.controller.js';
import { DashboardClock, DashboardService } from './dashboard.service.js';
@Module({
  imports: [RoomsModule, TaskSupervisionModule, ReportsModule],
  controllers: [DashboardController],
  providers: [DashboardService, DashboardClock],
  exports: [DashboardService],
})
export class DashboardModule {}
