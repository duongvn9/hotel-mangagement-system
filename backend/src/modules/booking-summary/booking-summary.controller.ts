import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { BookingSummaryService } from './booking-summary.service.js';
import { BookingSummaryResponse } from './dto/booking-summary.dto.js';

@ApiTags('bookings')
@Controller('bookings')
export class BookingSummaryController {
  constructor(private readonly summaries: BookingSummaryService) {}

  @Get(':id/summary')
  @Public()
  @ApiOperation({
    summary:
      'Booking detail view: stay, guest, rooms, invoice, payments and service orders (owner, staff, or booking code)',
  })
  @ApiOkResponse({ type: BookingSummaryResponse })
  summary(
    @Param('id') id: string,
    @CurrentUser() user?: AuthUser,
    @Query('code') code?: string,
  ) {
    return this.summaries.get(id, {
      ...(user ? { user } : {}),
      ...(code === undefined ? {} : { code }),
    });
  }
}
