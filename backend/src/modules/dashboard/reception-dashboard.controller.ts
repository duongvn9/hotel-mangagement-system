import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Role } from '../../common/constants/role.enum.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { ReceptionDashboard } from './dto/reception-dashboard.dto.js';
import { ReceptionDashboardService } from './reception-dashboard.service.js';

@ApiTags('dashboard')
@Roles(Role.Receptionist, Role.Manager)
@Controller('dashboard')
export class ReceptionDashboardController {
  constructor(private readonly dashboard: ReceptionDashboardService) {}

  @Get('reception')
  @ApiOperation({
    summary:
      "Reception overview — today's arrivals/departures, room status and pending requests, with independent source failures",
  })
  @ApiOkResponse({ type: ReceptionDashboard })
  @ApiBadRequestResponse()
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  reception(@Query() query: Record<string, unknown>) {
    if (Object.keys(query).length)
      throw new BadRequestException('Dashboard không nhận tham số truy vấn');
    return this.dashboard.reception();
  }
}
