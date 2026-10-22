import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthUser } from '../auth/auth-user.js';

/**
 * Lấy người dùng hiện tại: `me(@CurrentUser() user: AuthUser)`.
 * Trả về undefined khi chưa đăng nhập (endpoint @Public()).
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser | undefined =>
    ctx.switchToHttp().getRequest<Request>().user,
);
