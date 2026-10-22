import {
  ForbiddenException,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { Role } from '../../common/constants/role.enum.js';
import { ROLES_KEY } from '../../common/decorators/roles.decorator.js';

/** Phân quyền (BR-INT-02, BR-RBAC-03): chạy sau AuthGuard, so role của user với @Roles(). */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!roles?.length) return true;

    const role = context.switchToHttp().getRequest<Request>().user?.role;
    if (role && (roles as string[]).includes(role)) return true;
    throw new ForbiddenException('Không có quyền dùng chức năng này');
  }
}
