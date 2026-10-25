import { Body, Controller, Get, Headers, Post, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Role } from '../../common/constants/role.enum.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { MaintenanceService } from './maintenance.service.js';
import {
  MaintenanceTargets,
  MaintenanceTargetsQuery,
  ReportFaultDto,
  ReportReceipt,
} from './dto/report-fault.dto.js';

@ApiTags('maintenance')
@Controller('maintenance')
@Roles(Role.OperationsStaff)
@ApiUnauthorizedResponse()
@ApiForbiddenResponse()
export class MaintenanceController {
  constructor(private readonly maintenance: MaintenanceService) {}
  @Get('targets')
  @ApiOperation({
    summary: 'UC35 — Active maintenance targets, at most 20 per group',
  })
  @ApiOkResponse({ type: MaintenanceTargets })
  @ApiBadRequestResponse()
  targets(@Query() query: MaintenanceTargetsQuery) {
    return this.maintenance.targets(query);
  }
  @Post('reports')
  @ApiOperation({ summary: 'UC35 — Report equipment fault / damage' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: false,
    description:
      'UUID retained for retries of the same report. Omitted: server generates a new request key.',
  })
  @ApiCreatedResponse({ type: ReportReceipt })
  @ApiBadRequestResponse()
  @ApiConflictResponse({
    description: 'Same request key with different content',
  })
  @ApiServiceUnavailableResponse({
    description:
      'Partial write; message contains reportId. Retry the unchanged request with the same Idempotency-Key.',
  })
  report(
    @Body() dto: ReportFaultDto,
    @CurrentUser() user: AuthUser,
    @Headers('idempotency-key') key?: string,
  ) {
    return this.maintenance.report(dto, user, key);
  }
}
