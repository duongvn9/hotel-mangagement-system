import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Role } from '../../common/constants/role.enum.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Permissions } from '../../common/decorators/permissions.decorator.js';
import { RoomsService } from './rooms.service.js';
import { ListRoomsQuery } from './dto/list-rooms.dto.js';
import { RoomListResponse } from './dto/room-response.dto.js';

@ApiTags('rooms')
@Controller('rooms')
@Roles(Role.Manager)
@Permissions('facility:manage')
export class RoomsController {
  constructor(private readonly rooms: RoomsService) {}
  @Get()
  @ApiOperation({ summary: 'UC47 — View room list (read only)' })
  @ApiOkResponse({ type: RoomListResponse })
  @ApiBadRequestResponse()
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  list(@Query() query: ListRoomsQuery) {
    return this.rooms.list(query);
  }
}
