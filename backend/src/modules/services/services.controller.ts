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

@ApiTags('services')
@Controller('services')
@Roles(Role.Manager)
@Permissions('facility:manage')
export class ServicesController {
  constructor(private readonly services: ServicesService) {}
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
