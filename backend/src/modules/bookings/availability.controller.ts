import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator.js';
import {
  AvailableRoomResponse,
  SearchAvailabilityDto,
} from './dto/search-availability.dto.js';
import { AvailabilityService } from './availability.service.js';

@ApiTags('availability')
@Controller('availability')
export class AvailabilityController {
  constructor(private readonly availability: AvailabilityService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'UC05 — Search available rooms' })
  @ApiOkResponse({ type: [AvailableRoomResponse] })
  search(@Query() query: SearchAvailabilityDto) {
    return this.availability.findAvailableRooms(query);
  }
}
