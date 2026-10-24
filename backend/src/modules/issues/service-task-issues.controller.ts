import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { Role } from '../../common/constants/role.enum.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { ServiceTaskIssueDto } from './dto/create-issue.dto.js';
import { ServiceTaskIssuesService } from './service-task-issues.service.js';

@ApiTags('issues')
@Controller('issues/service-tasks')
export class ServiceTaskIssuesController {
  constructor(private readonly reports: ServiceTaskIssuesService) {}

  @Roles(Role.ServiceStaff)
  @Get(':taskId/context')
  context(@Param('taskId') taskId: string, @CurrentUser() user: AuthUser) {
    return this.reports.context(taskId, user);
  }

  @Roles(Role.ServiceStaff)
  @Post(':taskId')
  report(
    @Param('taskId') taskId: string,
    @Body() dto: ServiceTaskIssueDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.reports.report(taskId, dto, user);
  }
}
