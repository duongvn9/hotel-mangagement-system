import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '../../common/constants/role.enum.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { SameDayQuery, SameDayResponse } from './dto/same-day.dto.js';
import { FrontDeskService } from './front-desk.service.js';

@ApiTags('front-desk')
@Controller('front-desk')
export class FrontDeskController {
  constructor(private readonly frontDesk: FrontDeskService) {}

  @Get('same-day')
  @Roles(Role.Receptionist, Role.Manager)
  @ApiOperation({
    summary:
      'UC15 — Same-day check-in/out list: arrivals and departures of one day (Receptionist/Manager)',
  })
  @ApiOkResponse({ type: SameDayResponse })
  sameDay(@Query() query: SameDayQuery) {
    return this.frontDesk.sameDay(query);
  }
}
