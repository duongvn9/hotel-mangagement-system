import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator.js';
import {
  AvailableRoomResponse,
  SearchAvailabilityDto,
} from './dto/search-availability.dto.js';
import { AvailabilityService } from './availability.service.js';
import { RoomTypeSummaryResponse } from './dto/room-type-overview.dto.js';
import { RoomTypeOverviewService } from './room-type-overview.service.js';

@ApiTags('availability')
@Controller('availability')
export class AvailabilityController {
  constructor(
    private readonly availability: AvailabilityService,
    private readonly roomTypes: RoomTypeOverviewService,
  ) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'UC05 — Search available rooms' })
  @ApiOkResponse({ type: [AvailableRoomResponse] })
  search(@Query() query: SearchAvailabilityDto) {
    return this.availability.findAvailableRooms(query);
  }

  @Get('room-types')
  @Public()
  @ApiOperation({
    summary:
      'UC05 companion — every room type on sale, before any dates are chosen',
  })
  @ApiOkResponse({ type: [RoomTypeSummaryResponse] })
  roomTypeList() {
    return this.roomTypes.listPublic();
  }
}
