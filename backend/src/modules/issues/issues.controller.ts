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
  AssignIssueDto,
  CloseIssueDto,
  ReviewIssueDto,
} from './dto/review-issue.dto.js';
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

  @Roles(Role.Receptionist)
  @Patch(':id/review')
  review(
    @Param('id') id: string,
    @Body() dto: ReviewIssueDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.issues.review(id, dto, user);
  }

  @Roles(Role.Receptionist)
  @Get(':id/assignees')
  assignees(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.issues.assignees(id, user);
  }

  @Roles(Role.Receptionist)
  @Post(':id/assignment')
  assign(
    @Param('id') id: string,
    @Body() dto: AssignIssueDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.issues.assign(id, dto, user);
  }

  @Roles(Role.Receptionist, Role.Manager)
  @Post(':id/close')
  close(
    @Param('id') id: string,
    @Body() dto: CloseIssueDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.issues.close(id, dto, user);
  }

  @Roles(Role.Customer)
  @Post()
  create(@Body() dto: CreateIssueDto, @CurrentUser() user: AuthUser) {
    return this.issues.create(dto, user.id);
  }
}
