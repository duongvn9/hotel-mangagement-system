import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '../../common/constants/role.enum.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { GuestListResponse, ListGuestsQuery } from './dto/list-guests.dto.js';
import { GuestsService } from './guests.service.js';

@ApiTags('guests')
@Controller('guests')
export class GuestsController {
  constructor(private readonly guests: GuestsService) {}

  @Get()
  @Roles(Role.Receptionist, Role.Manager)
  @ApiOperation({
    summary:
      'UC14 — Search guest profiles built from bookings (Receptionist/Manager)',
  })
  @ApiOkResponse({ type: GuestListResponse })
  search(@Query() query: ListGuestsQuery) {
    return this.guests.search(query);
  }
}
