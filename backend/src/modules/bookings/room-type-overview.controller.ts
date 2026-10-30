import { Controller, Get, Param } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator.js';
import { RoomTypeOverviewResponse } from './dto/room-type-overview.dto.js';
import { RoomTypeOverviewService } from './room-type-overview.service.js';

/**
 * Endpoint công khai đi kèm UC05: Guest xem chi tiết một loại phòng (mô tả, tiện nghi, giá).
 * Tách khỏi RoomTypesController (chỉ Manager) nên dùng path riêng `:id/overview`, không đụng
 * route quản trị và không mở dữ liệu quản trị ra ngoài.
 */
@ApiTags('availability')
@Controller('room-types')
export class RoomTypeOverviewController {
  constructor(private readonly overview: RoomTypeOverviewService) {}

  @Get(':id/overview')
  @Public()
  @ApiOperation({ summary: 'UC05 companion — public room type details' })
  @ApiOkResponse({ type: RoomTypeOverviewResponse })
  findOne(@Param('id') id: string) {
    return this.overview.findPublicById(id);
  }
}
