import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, type Model } from 'mongoose';
import type { AuthUser } from '../../common/auth/auth-user.js';
import type { AppConfig } from '../../config/configuration.js';
import { Role } from '../roles/schemas/role.schema.js';
import { User } from '../users/schemas/user.schema.js';

export interface MeResponse {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  role: string;
  permissions: string[];
}

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private readonly users: Model<User>,
    @InjectModel(Role.name) private readonly roles: Model<Role>,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  /** UC02 bước 7: thông tin, role và permission của người đang đăng nhập. */
  async me(authUser: AuthUser): Promise<MeResponse> {
    const [user, role] = await Promise.all([
      isValidObjectId(authUser.id)
        ? this.users.findById(authUser.id).lean()
        : null,
      this.roles.findOne({ code: authUser.role }).lean(),
    ]);
    return {
      id: authUser.id,
      email: user?.email ?? authUser.email,
      // Header dev chỉ có role thì chưa có User thật trong DB.
      fullName: user?.fullName ?? `Dev ${authUser.role}`,
      phone: user?.phone,
      role: authUser.role,
      permissions: role?.permissions ?? [],
    };
  }

  /** Tài khoản để chọn ở màn đăng nhập dev (khi chưa cấu hình Firebase). Tắt ở production. */
  async devAccounts() {
    if (this.config.get('env', { infer: true }) === 'production') {
      throw new NotFoundException();
    }
    const users = await this.users
      .find({ isActive: true })
      .sort({ role: 1 })
      .limit(50)
      .select('email fullName role')
      .lean();
    return users.map((u) => ({
      id: String(u._id),
      email: u.email,
      fullName: u.fullName,
      role: u.role,
    }));
  }
}
