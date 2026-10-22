import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, type Model } from 'mongoose';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { Role as RoleCode } from '../../common/constants/role.enum.js';
import type { AppConfig } from '../../config/configuration.js';
import { Role } from '../roles/schemas/role.schema.js';
import type { ProfileDto } from '../users/dto/profile.dto.js';
import { User } from '../users/schemas/user.schema.js';
import { ID_TOKEN_VERIFIER, type IdTokenVerifier } from './firebase.module.js';

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
    @Inject(ID_TOKEN_VERIFIER) private readonly verifier: IdTokenVerifier,
  ) {}

  /**
   * UC01: tạo tài khoản HMS cho người vừa tạo tài khoản Firebase. Luôn là Customer (BR-ACC-03);
   * chưa xác minh email thì chưa đăng nhập được (BR-ACC-02, AuthGuard kiểm tra).
   */
  async register(idToken: string | undefined, dto: ProfileDto) {
    if (!idToken) throw new UnauthorizedException('Thiếu ID token Firebase');
    const decoded = await this.verifier.verifyIdToken(idToken).catch(() => {
      throw new UnauthorizedException('ID token không hợp lệ hoặc đã hết hạn');
    });
    if (!decoded.email) {
      throw new BadRequestException('Tài khoản Firebase phải có email');
    }
    const email = decoded.email.toLowerCase();

    // BR-ACC-01. Tài khoản do Manager tạo sẵn sẽ tự nối khi đăng nhập, không đăng ký lại.
    const exists = await this.users.exists({
      $or: [{ email }, { firebaseUid: decoded.uid }],
    });
    if (exists) throw new ConflictException('Email đã được sử dụng');

    try {
      const user = await this.users.create({
        ...dto,
        email,
        firebaseUid: decoded.uid,
        role: RoleCode.Customer,
        emailVerified: decoded.email_verified ?? false,
      });
      return { id: String(user._id), email, emailVerified: user.emailVerified };
    } catch (error) {
      // Hai request đăng ký cùng lúc: unique index chặn bản ghi thứ hai.
      if ((error as { code?: number }).code === 11000) {
        throw new ConflictException('Email đã được sử dụng');
      }
      throw error;
    }
  }

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
