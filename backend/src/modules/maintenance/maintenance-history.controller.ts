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
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Role } from '../../common/constants/role.enum.js';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { MaintenanceHistoryService } from './maintenance-history.service.js';
import {
  MaintenanceHistoryQuery,
  MaintenanceHistoryPage,
  MaintenanceHistoryDetail,
} from './dto/maintenance-history.dto.js';

@ApiTags('maintenance')
@Controller('maintenance/history')
@Roles(Role.OperationsStaff)
@ApiUnauthorizedResponse()
@ApiForbiddenResponse()
@ApiBadRequestResponse()
export class MaintenanceHistoryController {
  constructor(private readonly history: MaintenanceHistoryService) {}
  @Get()
  @ApiOperation({
    summary: 'UC36 — Read maintenance history in the current operational scope',
  })
  @ApiOkResponse({ type: MaintenanceHistoryPage })
  list(@Query() query: MaintenanceHistoryQuery, @CurrentUser() user: AuthUser) {
    return this.history.list(query, user);
  }
  @Get(':id')
  @ApiOperation({
    summary:
      'UC36 — Read a scoped maintenance history record; no write operations',
  })
  @ApiOkResponse({ type: MaintenanceHistoryDetail })
  @ApiNotFoundResponse({
    description: 'Missing record or outside operational scope',
  })
  detail(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.history.detail(id, user);
  }
}
