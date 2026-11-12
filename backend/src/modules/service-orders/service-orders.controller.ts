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
  AssignServiceOrderDto,
  IntakeServiceOrderDto,
  ReassignServiceOrderDto,
  ServiceHistoryQuery,
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

  @Post('intake')
  @Roles(Role.ServiceStaff, Role.Receptionist)
  intake(@Body() dto: IntakeServiceOrderDto, @CurrentUser() user: AuthUser) {
    return this.orders.intake(dto, user);
  }

  @Get('intake/contexts')
  @Roles(Role.ServiceStaff, Role.Receptionist)
  intakeContexts(@CurrentUser() user: AuthUser) {
    return this.orders.intakeContexts(user);
  }

  @Get('intake/performers')
  @Roles(Role.ServiceStaff)
  intakePerformers(@CurrentUser() user: AuthUser) {
    return this.orders.intakePerformers(user);
  }

  @Get('intake/catalog')
  @Roles(Role.ServiceStaff, Role.Receptionist)
  intakeCatalog(@CurrentUser() user: AuthUser) {
    return this.orders.intakeCatalog(user);
  }

  @Get('reports/me')
  @Roles(Role.ServiceStaff)
  reports(
    @Query() query: ListServiceOrdersQuery,
    @CurrentUser() user: AuthUser,
  ) {
    return this.orders.reports(query, user);
  }

  @Get('reports/:id')
  @Roles(Role.ServiceStaff)
  reportDetail(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.orders.reports(new ListServiceOrdersQuery(), user, id);
  }

  @Post(':id/reassignment')
  @Roles(Role.Receptionist)
  reassign(
    @Param('id') id: string,
    @Body() dto: ReassignServiceOrderDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.orders.reassign(id, dto, user);
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

  @Post(':id/assignment')
  @Roles(Role.Receptionist)
  assign(
    @Param('id') id: string,
    @Body() dto: AssignServiceOrderDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.orders.assign(id, dto, user);
  }

  @Get(':id/assignees')
  @Roles(Role.Receptionist)
  assignees(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.orders.assignees(id, user);
  }

  @Get('history/me')
  @Roles(Role.ServiceStaff)
  history(@Query() query: ServiceHistoryQuery, @CurrentUser() user: AuthUser) {
    return this.orders.history(query, user);
  }

  @Get('history/:id')
  @Roles(Role.ServiceStaff)
  historyDetail(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.orders.history(new ServiceHistoryQuery(), user, id);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.orders.findOne(id, user);
  }
}
