import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
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
  UpdateBookingDto,
  UpdatedBookingResponse,
  WalkInBookingResponse,
} from './dto/create-booking.dto.js';
import {
  CheckInDto,
  CheckInOptionsResponse,
  CheckInResult,
} from './dto/check-in.dto.js';
import {
  BookingListResponse,
  ListBookingsQuery,
} from './dto/list-bookings.dto.js';
import { BookingsService } from './bookings.service.js';
import { CheckInService } from './check-in.service.js';

@ApiTags('bookings')
@Controller('bookings')
export class BookingsController {
  constructor(
    private readonly bookings: BookingsService,
    private readonly checkIns: CheckInService,
  ) {}

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

  @Patch(':id')
  @Roles(Role.Receptionist, Role.Manager)
  @ApiOperation({
    summary:
      'UC11 — Update a pending/confirmed booking, re-checking availability (Receptionist/Manager)',
  })
  @ApiOkResponse({ type: UpdatedBookingResponse })
  @ApiConflictResponse({
    description: 'Rooms are unavailable, or the booking cannot be edited',
  })
  update(@Param('id') id: string, @Body() dto: UpdateBookingDto) {
    return this.bookings.update(id, dto);
  }

  @Post(':id/check-in')
  @Roles(Role.Receptionist, Role.Manager)
  @ApiOperation({
    summary:
      'UC16 — Check in a confirmed booking, optionally swapping rooms that are not ready (Receptionist/Manager)',
  })
  @ApiCreatedResponse({ type: CheckInResult })
  @ApiConflictResponse({
    description:
      'Booking cannot check in now, or its rooms are not ready or were just taken',
  })
  checkIn(@Param('id') id: string, @Body() dto: CheckInDto) {
    return this.checkIns.checkIn(id, dto);
  }

  @Get(':id/check-in-options')
  @Roles(Role.Receptionist, Role.Manager)
  @ApiOperation({
    summary:
      'UC16 — Per-room readiness and valid replacement rooms for a check-in (Receptionist/Manager)',
  })
  @ApiOkResponse({ type: CheckInOptionsResponse })
  checkInOptions(@Param('id') id: string) {
    return this.checkIns.options(id);
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
