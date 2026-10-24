import { Body, Controller, Post } from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { BookingResponse, CreateBookingDto } from './dto/create-booking.dto.js';
import { BookingsService } from './bookings.service.js';

@ApiTags('bookings')
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

  @Post()
  @ApiOperation({
    summary: 'UC — Create a booking (holds rooms until deposit)',
  })
  @ApiCreatedResponse({ type: BookingResponse })
  @ApiUnauthorizedResponse()
  @ApiConflictResponse({ description: 'Rooms are unavailable or just taken' })
  create(@Body() dto: CreateBookingDto, @CurrentUser() user: AuthUser) {
    return this.bookings.create(dto, user);
  }
}
