import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Role } from '../../common/constants/role.enum.js';
import { DashboardService } from './dashboard.service.js';
import { ManagerDashboard } from './dto/manager-dashboard.dto.js';
@ApiTags('dashboard')
@Roles(Role.Manager)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}
  @Get('manager')
  @ApiOperation({
    summary:
      'Manager overview — live read-only summaries with independent source failures',
  })
  @ApiOkResponse({ type: ManagerDashboard })
  @ApiBadRequestResponse()
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  manager(
    @CurrentUser() actor: AuthUser,
    @Query() query: Record<string, unknown>,
  ) {
    if (Object.keys(query).length)
      throw new BadRequestException('Dashboard không nhận tham số truy vấn');
    return this.dashboard.manager(actor);
  }
}
