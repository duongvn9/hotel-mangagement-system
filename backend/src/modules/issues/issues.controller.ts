import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ListIssuesQuery } from './dto/list-issues.dto.js';
import { ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { Role } from '../../common/constants/role.enum.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CreateIssueDto } from './dto/create-issue.dto.js';
import { IssuesService } from './issues.service.js';

@ApiTags('issues')
@Controller('issues')
export class IssuesController {
  constructor(private readonly issues: IssuesService) {}

  @Roles(Role.Customer, Role.Receptionist, Role.Manager)
  @Get()
  list(@Query() query: ListIssuesQuery, @CurrentUser() user: AuthUser) {
    return this.issues.list(query, user);
  }

  @Roles(Role.Customer, Role.Receptionist, Role.Manager)
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.issues.findOne(id, user);
  }

  @Roles(Role.Customer)
  @Post()
  create(@Body() dto: CreateIssueDto, @CurrentUser() user: AuthUser) {
    return this.issues.create(dto, user.id);
  }
}
