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
import { ListServicesQuery } from './dto/list-services.dto.js';
import { ServiceListResponse } from './dto/service-response.dto.js';
import { ServicesService } from './services.service.js';
import { Body, Param, Patch, Post } from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import { CreateServiceDto, UpdateServiceDto } from './dto/write-service.dto.js';
import { ServiceResponse } from './dto/service-response.dto.js';

@ApiTags('services')
@Controller('services')
@Roles(Role.Manager)
@Permissions('facility:manage')
export class ServicesController {
  constructor(private readonly services: ServicesService) {}
  @Post()
  @ApiOperation({
    summary:
      'UC54 — Create a service; billable and active requires a valid price',
  })
  @ApiCreatedResponse({ type: ServiceResponse })
  @ApiBadRequestResponse()
  @ApiConflictResponse()
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  create(@Body() dto: CreateServiceDto) {
    return this.services.create(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'UC54 — Service details for the editor' })
  @ApiOkResponse({ type: ServiceResponse })
  @ApiBadRequestResponse()
  @ApiNotFoundResponse()
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  detail(@Param('id') id: string) {
    return this.services.detail(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary:
      'UC54 — Partial update; validates the merged state and uses optimistic version locking',
  })
  @ApiOkResponse({ type: ServiceResponse })
  @ApiBadRequestResponse()
  @ApiNotFoundResponse()
  @ApiConflictResponse({
    description: 'Duplicate name or concurrent write: reload before retrying',
  })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  update(@Param('id') id: string, @Body() dto: UpdateServiceDto) {
    return this.services.update(id, dto);
  }

  @Get()
  @ApiOperation({
    summary:
      'UC53 — Service list (read only); missing prices sort last in either price direction',
  })
  @ApiOkResponse({ type: ServiceListResponse })
  @ApiBadRequestResponse()
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  list(@Query() query: ListServicesQuery) {
    return this.services.list(query);
  }
}
