import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  ValidationPipe,
} from '@nestjs/common';
import { UpdateTaskProgressDto } from './dto/update-task-progress.dto.js';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { Role } from '../../common/constants/role.enum.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Permissions } from '../../common/decorators/permissions.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import {
  AssignedTaskDto,
  AssignedTasksPageDto,
} from './dto/assigned-task.dto.js';
import { ListAssignedTasksQuery } from './dto/list-assigned-tasks.dto.js';
import { TasksService } from './tasks.service.js';

@ApiTags('tasks')
@ApiBearerAuth()
@Roles(Role.ServiceStaff, Role.OperationsStaff)
@Permissions('task:execute')
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get('me')
  @ApiOkResponse({ type: AssignedTasksPageDto })
  listMine(
    @CurrentUser() user: AuthUser,
    @Query(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    )
    query: ListAssignedTasksQuery,
  ) {
    return this.tasks.listAssigned(user.id, query);
  }

  @Patch(':id/progress')
  @ApiOkResponse({ type: AssignedTaskDto })
  progress(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    )
    input: UpdateTaskProgressDto,
  ) {
    return this.tasks.updateAssignedProgress(user.id, id, input);
  }

  @Get(':id')
  @ApiOkResponse({ type: AssignedTaskDto })
  @ApiNotFoundResponse({
    description: 'Task not found or not assigned to current user',
  })
  detail(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.tasks.findAssigned(user.id, id);
  }
}
