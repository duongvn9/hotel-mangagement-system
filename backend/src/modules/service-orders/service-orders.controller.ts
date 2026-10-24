import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { Role } from '../../common/constants/role.enum.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import {
  CreateServiceOrderDto,
  ListServiceOrdersQuery,
  ReviewServiceOrderDto,
} from './dto/service-order.dto.js';
import { ServiceOrdersService } from './service-orders.service.js';

@ApiTags('service-orders')
@Controller('service-orders')
@Roles(Role.Customer)
export class ServiceOrdersController {
  constructor(private readonly orders: ServiceOrdersService) {}

  @Post()
  create(@Body() dto: CreateServiceOrderDto, @CurrentUser() user: AuthUser) {
    return this.orders.create(dto, user);
  }

  @Get('me')
  list(@Query() query: ListServiceOrdersQuery, @CurrentUser() user: AuthUser) {
    return this.orders.list(query, user);
  }

  @Get('order-contexts')
  contexts(@CurrentUser() user: AuthUser) {
    return this.orders.orderContexts(user);
  }

  @Get('catalog')
  catalog(@CurrentUser() user: AuthUser) {
    return this.orders.catalog(user);
  }

  @Get('requests')
  @Roles(Role.Receptionist)
  requests(
    @Query() query: ListServiceOrdersQuery,
    @CurrentUser() user: AuthUser,
  ) {
    return this.orders.requests(query, user);
  }

  @Get('requests/:id')
  @Roles(Role.Receptionist)
  requestDetail(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.orders.requestDetail(id, user);
  }

  @Patch(':id/review')
  @Roles(Role.Receptionist)
  review(
    @Param('id') id: string,
    @Body() dto: ReviewServiceOrderDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.orders.review(id, dto, user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.orders.findOne(id, user);
  }
}
