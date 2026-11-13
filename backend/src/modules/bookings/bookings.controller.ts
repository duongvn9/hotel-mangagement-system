import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import type { AssetImageFile } from '../../common/asset-images.service.js';
import type { Response } from 'express';
import {
  ApiConflictResponse,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
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
  HoldBookingDto,
  HoldResponse,
  SubmitBookingDetailsDto,
} from './dto/hold-booking.dto.js';
import {
  GuestSession,
  type GuestSessionContext,
} from './guest-session.decorator.js';
import {
  CheckInDto,
  CheckInOptionsResponse,
  CheckInResult,
} from './dto/check-in.dto.js';
import {
  BookingListResponse,
  ListBookingsQuery,
} from './dto/list-bookings.dto.js';
import { MyBookingItem } from './dto/my-bookings.dto.js';
import { BookingsService } from './bookings.service.js';
import { CHECK_IN_EVIDENCE_MAX } from './check-in.core.js';
import { CheckInService } from './check-in.service.js';
import { ServicesService } from '../services/services.service.js';

@ApiTags('bookings')
@Controller('bookings')
export class BookingsController {
  constructor(
    private readonly bookings: BookingsService,
    private readonly checkIns: CheckInService,
    private readonly services: ServicesService,
  ) {}

  @Get('service-catalog')
  @Public()
  @ApiOperation({
    summary: 'Public catalog of active services a guest can add while booking',
  })
  @ApiOkResponse({ description: 'Active services for booking add-ons' })
  serviceCatalog() {
    return this.services.publicCatalog();
  }

  @Post('hold')
  @Public()
  @ApiOperation({
    summary:
      'Hold rooms when the guest starts booking (ROOM_HELD, 15-min hold)',
  })
  @ApiCreatedResponse({ type: HoldResponse })
  @ApiConflictResponse({ description: 'Rooms are unavailable or just taken' })
  @ApiTooManyRequestsResponse({
    description: 'Too many holds from this session',
  })
  hold(
    @Body() dto: HoldBookingDto,
    @GuestSession() session: GuestSessionContext,
    @CurrentUser() user?: AuthUser,
  ) {
    return this.bookings.hold(dto, session, user);
  }

  @Post('details')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Submit contact details for a held booking (ROOM_HELD → PENDING_DEPOSIT)',
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

  @Get('mine')
  @Roles(Role.Customer)
  @ApiOperation({
    summary: 'List the signed-in customer’s own bookings (newest first)',
  })
  @ApiOkResponse({ type: [MyBookingItem] })
  @ApiUnauthorizedResponse()
  myBookings(@CurrentUser() user: AuthUser) {
    return this.bookings.listForCustomer(user.id);
  }

  @Get('attention')
  @Roles(Role.Receptionist, Role.Manager)
  @ApiOperation({
    summary:
      'Counts of bookings needing attention: overdue and due-today check-ins/outs',
  })
  @ApiOkResponse({ description: 'Attention counts for reception' })
  attention() {
    return this.bookings.attention();
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

  @Get(':id')
  @Public()
  @ApiOperation({
    summary:
      'Read authoritative booking state and hold deadline from the server',
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

  @Get(':id/check-in-evidence')
  @Roles(Role.Receptionist, Role.Manager)
  @ApiOperation({
    summary:
      'How many check-in ID photos the booking has (Receptionist/Manager)',
  })
  checkInEvidenceCount(@Param('id') id: string) {
    return this.checkIns.evidenceCount(id);
  }

  @Get(':id/check-in-evidence/:index')
  @Roles(Role.Receptionist, Role.Manager)
  @ApiOperation({
    summary:
      'One check-in ID photo, streamed from private storage (Receptionist/Manager)',
  })
  async checkInEvidencePhoto(
    @Param('id') id: string,
    @Param('index', ParseIntPipe) index: number,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { body, contentType } = await this.checkIns.evidencePhoto(id, index);
    res.set({
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    return new StreamableFile(body, { type: contentType });
  }

  @Post(':id/check-in')
  @Roles(Role.Receptionist, Role.Manager)
  @UseInterceptors(
    FilesInterceptor('evidence', CHECK_IN_EVIDENCE_MAX, {
      limits: {
        fileSize: 5 * 1024 * 1024,
        files: CHECK_IN_EVIDENCE_MAX,
        fields: 2,
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary:
      'UC16 — Check in a confirmed booking with 1 to 5 ID photos, optionally swapping rooms that are not ready (Receptionist/Manager)',
  })
  @ApiCreatedResponse({ type: CheckInResult })
  @ApiConflictResponse({
    description:
      'Booking cannot check in now, or its rooms are not ready or were just taken',
  })
  checkIn(
    @Param('id') id: string,
    @Body() dto: CheckInDto,
    @UploadedFiles() evidence?: AssetImageFile[],
  ) {
    return this.checkIns.checkIn(id, dto, evidence);
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
