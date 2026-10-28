import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { Role } from '../../common/constants/role.enum.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import {
  OperationalReport,
  OperationalReportQuery,
} from './dto/operational-report.dto.js';
import { OperationalReportService } from './operational-report.service.js';
@ApiTags('reports')
@Roles(Role.Manager)
@Controller('reports')
export class OperationalReportController {
  constructor(private readonly reports: OperationalReportService) {}
  @Get('operational')
  @ApiOperation({
    summary:
      'UC57 — operational event statistics and separately labelled current snapshots',
  })
  @ApiOkResponse({ type: OperationalReport })
  @ApiBadRequestResponse()
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  operational(
    @Query() query: OperationalReportQuery,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.reports.operational(query, actor);
  }
}
