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
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
} from '@nestjs/swagger';
import { Role } from '../../common/constants/role.enum.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Permissions } from '../../common/decorators/permissions.decorator.js';
import { ListRoomTypesQuery } from './dto/list-room-types.dto.js';
import { RoomTypeListResponse } from './dto/room-type-response.dto.js';
import { RoomTypesService } from './room-types.service.js';
import {
  CreateRoomTypeDto,
  UpdateRoomTypeDto,
} from './dto/write-room-type.dto.js';
import { RoomTypeResponse } from './dto/room-type-response.dto.js';
import { RoomTypeOptionResponse } from './dto/room-type-option.dto.js';

@ApiTags('room-types')
@Controller('room-types')
@Roles(Role.Manager)
@Permissions('facility:manage')
@ApiUnauthorizedResponse()
@ApiForbiddenResponse()
export class RoomTypesController {
  constructor(private readonly roomTypes: RoomTypesService) {}

  @Get('options')
  @ApiOperation({
    summary: 'UC48 — All active RoomType options, sorted by name',
  })
  @ApiOkResponse({ type: [RoomTypeOptionResponse] })
  options() {
    return this.roomTypes.options();
  }

  @Post()
  @ApiOperation({ summary: 'UC50 — Create room type' })
  @ApiCreatedResponse({ type: RoomTypeResponse })
  @ApiBadRequestResponse()
  @ApiConflictResponse()
  create(@Body() dto: CreateRoomTypeDto) {
    return this.roomTypes.create(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'UC50 — Room type form details' })
  @ApiOkResponse({ type: RoomTypeResponse })
  @ApiBadRequestResponse()
  @ApiNotFoundResponse()
  detail(@Param('id') id: string) {
    return this.roomTypes.detail(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'UC50 — Update or deactivate room type' })
  @ApiOkResponse({ type: RoomTypeResponse })
  @ApiBadRequestResponse()
  @ApiNotFoundResponse()
  @ApiConflictResponse()
  update(@Param('id') id: string, @Body() dto: UpdateRoomTypeDto) {
    return this.roomTypes.update(id, dto);
  }

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
