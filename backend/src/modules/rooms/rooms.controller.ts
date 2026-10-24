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
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
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
import { RoomListResponse, RoomResponse } from './dto/room-response.dto.js';
import { CreateRoomDto, UpdateRoomDto } from './dto/write-room.dto.js';

@ApiTags('rooms')
@Controller('rooms')
@Roles(Role.Manager)
@Permissions('facility:manage')
@ApiUnauthorizedResponse()
@ApiForbiddenResponse()
export class RoomsController {
  constructor(private readonly rooms: RoomsService) {}
  @Post()
  @ApiOperation({ summary: 'UC48 — Create a physical room' })
  @ApiCreatedResponse({ type: RoomResponse })
  @ApiBadRequestResponse({
    description:
      'Invalid body or inactive/missing RoomType; at least one active RoomType is required',
  })
  @ApiConflictResponse({
    description: 'Room number already exists (case sensitive)',
  })
  create(@Body() dto: CreateRoomDto) {
    return this.rooms.create(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'UC48 — Room form details' })
  @ApiOkResponse({ type: RoomResponse })
  @ApiBadRequestResponse()
  @ApiNotFoundResponse()
  detail(@Param('id') id: string) {
    return this.rooms.detail(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary:
      'UC48 — Update, deactivate or reactivate a room; preserves reservations',
  })
  @ApiOkResponse({ type: RoomResponse })
  @ApiBadRequestResponse({
    description: 'Invalid/empty body or reactivation with inactive RoomType',
  })
  @ApiNotFoundResponse()
  @ApiConflictResponse()
  update(@Param('id') id: string, @Body() dto: UpdateRoomDto) {
    return this.rooms.update(id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'UC47 — View room list' })
  @ApiOkResponse({ type: RoomListResponse })
  @ApiBadRequestResponse()
  list(@Query() query: ListRoomsQuery) {
    return this.rooms.list(query);
  }
}
