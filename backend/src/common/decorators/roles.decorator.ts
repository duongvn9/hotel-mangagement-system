import { SetMetadata } from '@nestjs/common';
import { Role } from '../constants/role.enum.js';

export const ROLES_KEY = 'roles';

/**
 * Gắn role được phép gọi endpoint, ví dụ @Roles(Role.Manager).
 * RolesGuard đọc metadata này (làm trong task "Xác thực Firebase + middleware RBAC").
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
