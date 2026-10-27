import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Role } from '../../common/constants/role.enum.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import {
  BookingResponse,
  CancelBookingDto,
  CreateBookingDto,
  WalkInBookingResponse,
} from './dto/create-booking.dto.js';
import {
  BookingListResponse,
  ListBookingsQuery,
} from './dto/list-bookings.dto.js';
import { BookingsService } from './bookings.service.js';

@ApiTags('bookings')
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

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

  @Get()
  @Roles(Role.Receptionist, Role.Manager)
  @ApiOperation({
    summary:
      'UC10 — List bookings with filters and paging (Receptionist/Manager)',
  })
  @ApiOkResponse({ type: BookingListResponse })
  list(@Query() query: ListBookingsQuery) {
    return this.bookings.list(query);
  }

  @Post('walk-in')
  @Roles(Role.Receptionist, Role.Manager)
  @ApiOperation({
    summary:
      'UC08 — Create a confirmed booking for a walk-in guest (Receptionist/Manager)',
  })
  @ApiCreatedResponse({ type: WalkInBookingResponse })
  @ApiConflictResponse({ description: 'Rooms are unavailable or just taken' })
  createWalkIn(@Body() dto: CreateBookingDto, @CurrentUser() user: AuthUser) {
    return this.bookings.createWalkIn(dto, user);
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
