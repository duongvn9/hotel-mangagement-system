import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard.js';

function run(roles: string[] | undefined, role?: string) {
  const reflector = { getAllAndOverride: () => roles } as unknown as Reflector;
  const ctx = {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({
      getRequest: () => ({ user: role ? { role } : undefined }),
    }),
  } as unknown as ExecutionContext;
  return new RolesGuard(reflector).canActivate(ctx);
}

describe('RolesGuard', () => {
  it('endpoint không gắn @Roles(): cho qua', () => {
    expect(run(undefined)).toBe(true);
    expect(run([])).toBe(true);
  });

  it('role nằm trong @Roles(): cho qua', () => {
    expect(run(['RECEPTIONIST', 'MANAGER'], 'MANAGER')).toBe(true);
  });

  it('sai role hoặc chưa đăng nhập: 403', () => {
    expect(() => run(['MANAGER'], 'CUSTOMER')).toThrow(ForbiddenException);
    expect(() => run(['MANAGER'])).toThrow(ForbiddenException);
  });
});
