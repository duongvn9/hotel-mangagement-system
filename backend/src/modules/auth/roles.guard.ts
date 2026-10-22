import {
  ForbiddenException,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectModel } from '@nestjs/mongoose';
import type { Request } from 'express';
import type { Model } from 'mongoose';
import { PERMISSIONS_KEY } from '../../common/decorators/permissions.decorator.js';
import { ROLES_KEY } from '../../common/decorators/roles.decorator.js';
import { Role } from '../roles/schemas/role.schema.js';

/**
 * Phân quyền (BR-INT-02, BR-RBAC-03), chạy sau AuthGuard: user qua được nếu role nằm trong
 * @Roles(), hoặc role đang dùng có đủ các permission trong @Permissions() (UC45).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectModel(Role.name) private readonly roles: Model<Role>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    const roles = this.reflector.getAllAndOverride<string[] | undefined>(
      ROLES_KEY,
      targets,
    );
    const permissions = this.reflector.getAllAndOverride<string[] | undefined>(
      PERMISSIONS_KEY,
      targets,
    );
    if (!roles?.length && !permissions?.length) return true;

    const role = context.switchToHttp().getRequest<Request>().user?.role;
    if (role && roles?.includes(role)) return true;
    // Chỉ đọc DB khi role không có sẵn trong @Roles() mà endpoint cho phép theo permission.
    if (
      role &&
      permissions?.length &&
      (await this.roles.exists({
        code: role,
        isActive: true,
        permissions: { $all: permissions },
      }))
    ) {
      return true;
    }
    throw new ForbiddenException('Không có quyền dùng chức năng này');
  }
}
