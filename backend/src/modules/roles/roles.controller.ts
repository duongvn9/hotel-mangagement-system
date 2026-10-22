import { Body, Controller, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Role } from '../../common/constants/role.enum.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import {
  CreateRoleDto,
  SetPermissionsDto,
  UpdateRoleDto,
} from './dto/role.dto.js';
import { RolesService } from './roles.service.js';

/** UC44-46: chỉ Manager quản lý role và permission (BR-RBAC-02). */
@ApiTags('roles')
@Roles(Role.Manager)
@Controller()
export class RolesController {
  constructor(private readonly roles: RolesService) {}

  @Get('permissions')
  listPermissions() {
    return this.roles.listPermissions();
  }

  @Get('roles')
  list() {
    return this.roles.list();
  }

  @Get('roles/:id')
  findOne(@Param('id') id: string) {
    return this.roles.findOne(id);
  }

  @Post('roles')
  create(@Body() dto: CreateRoleDto) {
    return this.roles.create(dto);
  }

  @Patch('roles/:id')
  update(@Param('id') id: string, @Body() dto: UpdateRoleDto) {
    return this.roles.update(id, dto);
  }

  @Put('roles/:id/permissions')
  setPermissions(@Param('id') id: string, @Body() dto: SetPermissionsDto) {
    return this.roles.setPermissions(id, dto);
  }
}
