import {
  BadRequestException,
  Injectable,
  type NestMiddleware,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NextFunction, Request, Response } from 'express';
import type { AppConfig } from '../../config/configuration.js';
import { Role } from '../constants/role.enum.js';

const ROLES: string[] = Object.values(Role);
const OBJECT_ID = /^[a-f\d]{24}$/i;
/** Id mặc định khi chỉ gửi x-dev-role, chưa có User thật trong DB. */
export const DEV_USER_ID = '000000000000000000000001';

/**
 * Giả lập người dùng ở dev/test (hợp đồng H2), để test API theo role khi chưa có Firebase:
 *   x-dev-role: MANAGER                      (mặc định CUSTOMER)
 *   x-dev-user-id: <_id của User trong DB>   (mặc định DEV_USER_ID)
 * Tắt hẳn khi NODE_ENV=production. Guard Firebase (#15) phải giữ nguyên req.user đã gắn ở đây.
 */
@Injectable()
export class DevAuthMiddleware implements NestMiddleware {
  private readonly enabled: boolean;

  constructor(config: ConfigService<AppConfig, true>) {
    this.enabled = config.get('env', { infer: true }) !== 'production';
  }

  use(req: Request, _res: Response, next: NextFunction) {
    const id = req.header('x-dev-user-id');
    const role = req.header('x-dev-role');
    if (!this.enabled || (!id && !role)) return next();

    if (role && !ROLES.includes(role)) {
      throw new BadRequestException(
        `x-dev-role phải là một trong: ${ROLES.join(', ')}`,
      );
    }
    if (id && !OBJECT_ID.test(id)) {
      throw new BadRequestException(
        'x-dev-user-id phải là ObjectId 24 ký tự hex',
      );
    }

    const userRole = role ?? Role.Customer;
    req.user = {
      id: id ?? DEV_USER_ID,
      email: `dev-${userRole.toLowerCase()}@hms.local`,
      role: userRole,
    };
    next();
  }
}
