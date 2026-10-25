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
import { RevenueReport, RevenueReportQuery } from './dto/revenue-report.dto.js';
import { RevenueReportService } from './revenue-report.service.js';
@ApiTags('reports')
@Roles(Role.Manager)
@Controller('reports')
export class ReportsController {
  constructor(private readonly revenue: RevenueReportService) {}
  @Get('revenue')
  @ApiOperation({
    summary:
      'UC56 — Revenue from recorded successful payments (Vietnam business dates)',
  })
  @ApiOkResponse({ type: RevenueReport })
  @ApiBadRequestResponse()
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  revenueReport(
    @Query() query: RevenueReportQuery,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.revenue.revenue(query, actor);
  }
}
