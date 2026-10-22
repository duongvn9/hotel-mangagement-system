import {
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectModel } from '@nestjs/mongoose';
import type { Request } from 'express';
import type { Model } from 'mongoose';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator.js';
import { User } from '../users/schemas/user.schema.js';
import {
  ID_TOKEN_VERIFIER,
  type IdTokenVerifier,
} from './firebase.provider.js';

/**
 * Xác thực (BR-INT-01, BR-ACC-02, BR-ACC-04): đọc `Authorization: Bearer <Firebase ID token>`,
 * tìm User trong HMS rồi gắn vào req.user. Endpoint @Public() vẫn chạy khi không có hoặc sai token.
 * req.user đã có sẵn (DevAuthMiddleware ở dev) thì giữ nguyên.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(ID_TOKEN_VERIFIER) private readonly verifier: IdTokenVerifier,
    @InjectModel(User.name) private readonly users: Model<User>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const req = context.switchToHttp().getRequest<Request>();
    if (req.user) return true;

    const token = req.header('authorization')?.match(/^Bearer (.+)$/i)?.[1];
    if (!token) {
      if (isPublic) return true;
      throw new UnauthorizedException('Cần đăng nhập');
    }

    try {
      req.user = await this.authenticate(token);
    } catch (error) {
      if (isPublic) return true;
      throw error;
    }
    return true;
  }

  private async authenticate(token: string): Promise<AuthUser> {
    const decoded = await this.verifier.verifyIdToken(token).catch(() => {
      throw new UnauthorizedException(
        'Phiên đăng nhập không hợp lệ hoặc đã hết hạn',
      );
    });

    // BR-ACC-02. Kiểm tra trước khi nối theo email để không ai chiếm tài khoản bằng email chưa xác minh.
    if (!decoded.email_verified) {
      throw new ForbiddenException('Email chưa được xác minh');
    }

    // Tài khoản seed hoặc do Manager tạo chưa có firebaseUid: nối theo email ở lần đầu đăng nhập.
    const user =
      (await this.users.findOne({ firebaseUid: decoded.uid }).lean()) ??
      (decoded.email
        ? await this.users
            .findOneAndUpdate(
              {
                email: decoded.email.toLowerCase(),
                firebaseUid: { $exists: false },
              },
              { $set: { firebaseUid: decoded.uid, emailVerified: true } },
              { new: true },
            )
            .lean()
        : null);

    if (!user) {
      throw new UnauthorizedException('Tài khoản chưa đăng ký trong HMS');
    }
    if (!user.isActive) throw new ForbiddenException('Tài khoản đã bị khoá');
    if (!user.emailVerified) {
      await this.users.updateOne({ _id: user._id }, { emailVerified: true });
    }

    return { id: String(user._id), email: user.email, role: user.role };
  }
}
