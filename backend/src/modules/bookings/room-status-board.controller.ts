import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '../../common/constants/role.enum.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { RoomStatusBoardQuery } from './dto/room-status-board.dto.js';
import { RoomStatusBoardService } from './room-status-board.service.js';

@ApiTags('rooms')
@Controller('room-status-board')
export class RoomStatusBoardController {
  constructor(private readonly board: RoomStatusBoardService) {}

  @Get()
  @Roles(Role.Receptionist, Role.Manager)
  @ApiOperation({
    summary:
      'UC13 — Room availability & status board for one day (Receptionist/Manager)',
  })
  @ApiOkResponse({ description: 'Rooms with occupancy for the chosen day' })
  get(@Query() query: RoomStatusBoardQuery) {
    return this.board.board(query);
  }
}
