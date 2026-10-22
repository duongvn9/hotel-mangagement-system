import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import type { Model } from 'mongoose';
import { PERMISSIONS_KEY } from '../../common/decorators/permissions.decorator.js';
import { ROLES_KEY } from '../../common/decorators/roles.decorator.js';
import type { Role } from '../roles/schemas/role.schema.js';
import { RolesGuard } from './roles.guard.js';

function run({
  roles,
  permissions,
  role,
  roleHasPermissions = false,
}: {
  roles?: string[];
  permissions?: string[];
  role?: string;
  roleHasPermissions?: boolean;
}) {
  const meta: Record<string, unknown> = {
    [ROLES_KEY]: roles,
    [PERMISSIONS_KEY]: permissions,
  };
  const reflector = {
    getAllAndOverride: (key: string) => meta[key],
  } as unknown as Reflector;
  const model = {
    exists: vi.fn(() =>
      Promise.resolve(roleHasPermissions ? { _id: 'r' } : null),
    ),
  };
  const ctx = {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({
      getRequest: () => ({ user: role ? { role } : undefined }),
    }),
  } as unknown as ExecutionContext;
  const result = new RolesGuard(
    reflector,
    model as unknown as Model<Role>,
  ).canActivate(ctx);
  return { result, model };
}

describe('RolesGuard', () => {
  it('endpoint không gắn @Roles(), @Permissions(): cho qua', async () => {
    await expect(run({}).result).resolves.toBe(true);
    await expect(run({ roles: [] }).result).resolves.toBe(true);
  });

  it('role nằm trong @Roles(): cho qua, không đọc DB', async () => {
    const { result, model } = run({
      roles: ['RECEPTIONIST', 'MANAGER'],
      permissions: ['task:execute'],
      role: 'MANAGER',
    });
    await expect(result).resolves.toBe(true);
    expect(model.exists).not.toHaveBeenCalled();
  });

  it('sai role hoặc chưa đăng nhập: 403', async () => {
    await expect(
      run({ roles: ['MANAGER'], role: 'CUSTOMER' }).result,
    ).rejects.toThrow(ForbiddenException);
    await expect(run({ roles: ['MANAGER'] }).result).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('role tự tạo có đủ permission của endpoint: cho qua (UC45)', async () => {
    const { result, model } = run({
      roles: ['SERVICE_STAFF'],
      permissions: ['task:execute'],
      role: 'HOUSEKEEPING',
      roleHasPermissions: true,
    });
    await expect(result).resolves.toBe(true);
    expect(model.exists).toHaveBeenCalledWith({
      code: 'HOUSEKEEPING',
      isActive: true,
      permissions: { $all: ['task:execute'] },
    });
  });

  it('role thiếu permission: 403', async () => {
    await expect(
      run({
        permissions: ['task:execute'],
        role: 'CUSTOMER',
        roleHasPermissions: false,
      }).result,
    ).rejects.toThrow(ForbiddenException);
  });
});
