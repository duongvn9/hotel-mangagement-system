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
  ApiProperty,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Permissions } from '../../common/decorators/permissions.decorator.js';
import { Role } from '../../common/constants/role.enum.js';
import { BedTypesService } from './bed-types.service.js';
import {
  CreateBedTypeDto,
  UpdateBedTypeDto,
} from './dto/write-bed-type.dto.js';
import {
  BedTypeListResponse,
  BedTypeResponse,
} from './dto/bed-type-response.dto.js';
import { ListBedTypesQuery } from './dto/list-bed-types.dto.js';

export class BedTypeOptionDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
}

@ApiTags('bed-types')
@Controller('bed-types')
@Roles(Role.Manager)
@Permissions('facility:manage')
export class BedTypesController {
  constructor(private readonly bedTypes: BedTypesService) {}

  @Get('options')
  @ApiOkResponse({ type: [BedTypeOptionDto] })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  options() {
    return this.bedTypes.options();
  }

  @Post()
  @ApiOperation({ summary: 'Create a bed type' })
  @ApiCreatedResponse({ type: BedTypeResponse })
  @ApiBadRequestResponse()
  @ApiConflictResponse()
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  create(@Body() dto: CreateBedTypeDto) {
    return this.bedTypes.create(dto);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Bed type details including room types that use it',
  })
  @ApiOkResponse({ type: BedTypeResponse })
  @ApiBadRequestResponse()
  @ApiNotFoundResponse()
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  detail(@Param('id') id: string) {
    return this.bedTypes.detail(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Partial update of a bed type' })
  @ApiOkResponse({ type: BedTypeResponse })
  @ApiBadRequestResponse()
  @ApiNotFoundResponse()
  @ApiConflictResponse()
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  update(@Param('id') id: string, @Body() dto: UpdateBedTypeDto) {
    return this.bedTypes.update(id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List bed types and room-type usage (read only)' })
  @ApiOkResponse({ type: BedTypeListResponse })
  @ApiBadRequestResponse()
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  list(@Query() query: ListBedTypesQuery) {
    return this.bedTypes.list(query);
  }
}
