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
  CreateAccountDto,
  ListAccountsQuery,
  UpdateAccountDto,
} from './dto/account.dto.js';
import { UpdateProfileDto } from './dto/profile.dto.js';
import { UsersService } from './users.service.js';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  /** UC04 Update Profile. Khai báo trước `:id` để 'me' không bị hiểu là id. */
  @Patch('me')
  updateProfile(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.users.updateProfile(user.id, dto);
  }

  /** UC42 View Account List (BR-RBAC-01). */
  @Roles(Role.Manager)
  @Get()
  list(@Query() query: ListAccountsQuery) {
    return this.users.list(query);
  }

  @Roles(Role.Manager)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.users.findOne(id);
  }

  /** UC43 Create Account. */
  @Roles(Role.Manager)
  @Post()
  create(@Body() dto: CreateAccountDto) {
    return this.users.create(dto);
  }

  /** UC43 Update Account. */
  @Roles(Role.Manager)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAccountDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.users.update(id, dto, user.id);
  }
}
