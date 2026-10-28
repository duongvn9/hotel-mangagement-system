import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import {
  BookingResponse,
  CancelBookingDto,
  CreateBookingDto,
} from './dto/create-booking.dto.js';
import {
  HoldBookingDto,
  HoldResponse,
  SubmitBookingDetailsDto,
} from './dto/hold-booking.dto.js';
import {
  GuestSession,
  type GuestSessionContext,
} from './guest-session.decorator.js';
import { BookingsService } from './bookings.service.js';

@ApiTags('bookings')
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

  @Post('hold')
  @Public()
  @ApiOperation({
    summary: 'Hold rooms when the guest starts booking (ROOM_HELD, 15-min hold)',
  })
  @ApiCreatedResponse({ type: HoldResponse })
  @ApiConflictResponse({ description: 'Rooms are unavailable or just taken' })
  @ApiTooManyRequestsResponse({ description: 'Too many holds from this session' })
  hold(
    @Body() dto: HoldBookingDto,
    @GuestSession() session: GuestSessionContext,
    @CurrentUser() user?: AuthUser,
  ) {
    return this.bookings.hold(dto, session, user);
  }

  @Post('details')
  @Public()
  @ApiOperation({
    summary: 'Submit contact details for a held booking (ROOM_HELD → PENDING_DEPOSIT)',
  })
  @ApiOkResponse({ type: HoldResponse })
  @ApiConflictResponse({ description: 'Hold expired or not awaiting details' })
  submitDetails(@Body() dto: SubmitBookingDetailsDto) {
    return this.bookings.submitDetails(dto);
  }

  @Post()
  @Public()
  @ApiOperation({
    summary: 'UC46 — Create a booking (Guest or Customer; holds rooms)',
  })
  @ApiCreatedResponse({ type: BookingResponse })
  @ApiConflictResponse({ description: 'Rooms are unavailable or just taken' })
  create(@Body() dto: CreateBookingDto, @CurrentUser() user?: AuthUser) {
    return this.bookings.create(dto, user);
  }

  @Get(':id')
  @Public()
  @ApiOperation({
    summary: 'Read authoritative booking state and hold deadline from the server',
  })
  @ApiOkResponse({ description: 'Authoritative booking state' })
  getBooking(
    @Param('id') id: string,
    @GuestSession() session: GuestSessionContext,
    @CurrentUser() user?: AuthUser,
    @Query('code') code?: string,
  ) {
    return this.bookings.getBooking(id, {
      ...(user ? { user } : {}),
      ...(code === undefined ? {} : { code }),
      ...(session.sessionId ? { sessionId: session.sessionId } : {}),
    });
  }

  @Post(':id/cancel')
  @Public()
  @ApiOperation({
    summary:
      'Cancel a booking and release its room hold (owner/staff/guest code)',
  })
  @ApiOkResponse({ description: 'Booking cancelled' })
  @ApiConflictResponse({
    description: 'Booking cannot be cancelled at this stage',
  })
  cancel(
    @Param('id') id: string,
    @Body() dto: CancelBookingDto,
    @CurrentUser() user?: AuthUser,
  ) {
    return this.bookings.cancel(id, {
      ...(user ? { user } : {}),
      ...(dto.code === undefined ? {} : { code: dto.code }),
    });
  }
}
