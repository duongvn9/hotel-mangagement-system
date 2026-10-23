import { Controller, Get, Query } from '@nestjs/common';
import { ApiForbiddenResponse, ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { Role } from '../../common/constants/role.enum.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Permissions } from '../../common/decorators/permissions.decorator.js';
import { ListRoomTypesQuery } from './dto/list-room-types.dto.js';
import { RoomTypeListResponse } from './dto/room-type-response.dto.js';
import { RoomTypesService } from './room-types.service.js';

@ApiTags('room-types')
@Controller('room-types')
export class RoomTypesController {
  constructor(private readonly roomTypes: RoomTypesService) {}

  @Get()
  @Roles(Role.Manager)
  @Permissions('facility:manage')
  @ApiOperation({ summary: 'UC49 — View room type list' })
  @ApiOkResponse({ type: RoomTypeListResponse })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  list(@Query() query: ListRoomTypesQuery) {
    return this.roomTypes.list(query);
  }
}
