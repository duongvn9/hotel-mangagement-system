import { Controller, Get } from '@nestjs/common';
import {
  ApiProperty,
  ApiTags,
  ApiOkResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Permissions } from '../../common/decorators/permissions.decorator.js';
import { Role } from '../../common/constants/role.enum.js';
import { AmenitiesService } from './amenities.service.js';
import { Query } from '@nestjs/common';
import { ApiBadRequestResponse, ApiOperation } from '@nestjs/swagger';
import { ListAmenitiesQuery } from './dto/list-amenities.dto.js';
import { AmenityListResponse } from './dto/amenity-response.dto.js';

export class AmenityOptionDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
}

@ApiTags('amenities')
@Controller('amenities')
@Roles(Role.Manager)
@Permissions('facility:manage')
export class AmenitiesController {
  constructor(private readonly amenities: AmenitiesService) {}

  @Get('options')
  @ApiOkResponse({ type: [AmenityOptionDto] })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  options() {
    return this.amenities.options();
  }

  @Get()
  @ApiOperation({
    summary:
      'UC51 — View amenity list and reverse RoomType assignments (read only)',
  })
  @ApiOkResponse({ type: AmenityListResponse })
  @ApiBadRequestResponse()
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  list(@Query() query: ListAmenitiesQuery) {
    return this.amenities.list(query);
  }
}
