import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Role } from '../../common/constants/role.enum.js';
import { TaskSupervisionService } from './task-supervision.service.js';
import {
  TaskQueueFilters,
  TaskQueueListQuery,
  TaskQueueSummary,
  SupervisedTaskPage,
  SupervisedTaskDetail,
} from './dto/task-queues.dto.js';

@ApiTags('task-supervision')
@Controller('task-queues')
@Roles(Role.Manager)
@ApiUnauthorizedResponse()
@ApiForbiddenResponse()
@ApiBadRequestResponse()
export class TaskSupervisionController {
  constructor(private readonly supervision: TaskSupervisionService) {}
  @Get('summary')
  @ApiOperation({
    summary: 'UC55 — Live queue counts and workload, with no stored counters',
  })
  @ApiOkResponse({ type: TaskQueueSummary })
  summary(@Query() query: TaskQueueFilters, @CurrentUser() actor: AuthUser) {
    return this.supervision.summary(query, actor);
  }
  @Get('tasks')
  @ApiOperation({
    summary:
      'UC55 — Read current tasks; null time values sort last in both directions',
  })
  @ApiOkResponse({ type: SupervisedTaskPage })
  list(@Query() query: TaskQueueListQuery, @CurrentUser() actor: AuthUser) {
    return this.supervision.list(query, actor);
  }
  @Get('tasks/:id')
  @ApiOperation({
    summary:
      'UC55 — Read current task details; only maintenance sources are expanded',
  })
  @ApiOkResponse({ type: SupervisedTaskDetail })
  @ApiNotFoundResponse()
  detail(@Param('id') id: string, @CurrentUser() actor: AuthUser) {
    return this.supervision.detail(id, actor);
  }
}
