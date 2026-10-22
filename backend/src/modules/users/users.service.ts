import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, type Model } from 'mongoose';
import {
  FIREBASE_USER_ADMIN,
  type FirebaseUserAdmin,
} from '../auth/firebase.module.js';
import { Role } from '../roles/schemas/role.schema.js';
import type {
  CreateAccountDto,
  ListAccountsQuery,
  UpdateAccountDto,
} from './dto/account.dto.js';
import type { UpdateProfileDto } from './dto/profile.dto.js';
import { User } from './schemas/user.schema.js';

type LeanUser = User & { _id: unknown; createdAt?: Date };

const toAccount = (user: LeanUser) => ({
  id: String(user._id),
  email: user.email,
  fullName: user.fullName,
  phone: user.phone,
  role: user.role,
  isActive: user.isActive,
  emailVerified: user.emailVerified,
  hasFirebaseAccount: Boolean(user.firebaseUid),
  createdAt: user.createdAt,
});

const escapeRegex = (text: string) =>
  text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** phone rỗng nghĩa là xoá số điện thoại (UC04, UC43). */
const toUpdate = ({ phone, ...rest }: { phone?: string }) =>
  phone === ''
    ? { $set: rest, $unset: { phone: 1 } }
    : { $set: phone ? { ...rest, phone } : rest };

const isDuplicateKey = (error: unknown) =>
  (error as { code?: number }).code === 11000;

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly users: Model<User>,
    @InjectModel(Role.name) private readonly roles: Model<Role>,
    @Inject(FIREBASE_USER_ADMIN) private readonly firebase: FirebaseUserAdmin,
  ) {}

  /** UC04: chỉ sửa hồ sơ của chính mình. */
  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = isValidObjectId(userId)
      ? await this.users
          .findByIdAndUpdate(userId, toUpdate(dto), {
            new: true,
            runValidators: true,
          })
          .lean()
      : null;
    if (!user) throw new NotFoundException('Không tìm thấy tài khoản');
    return toAccount(user);
  }

  /** UC42 View Account List. */
  async list({ search, role, isActive, page, limit }: ListAccountsQuery) {
    const filter: Record<string, unknown> = {};
    if (role) filter.role = role;
    if (isActive !== undefined) filter.isActive = isActive;
    if (search?.trim()) {
      const pattern = new RegExp(escapeRegex(search.trim()), 'i');
      filter.$or = [
        { fullName: pattern },
        { email: pattern },
        { phone: pattern },
      ];
    }
    const [items, total] = await Promise.all([
      this.users
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.users.countDocuments(filter),
    ]);
    return { items: items.map(toAccount), total, page, limit };
  }

  async findOne(id: string) {
    const user = isValidObjectId(id)
      ? await this.users.findById(id).lean()
      : null;
    if (!user) throw new NotFoundException('Không tìm thấy tài khoản');
    return toAccount(user);
  }

  /** UC43 Create Account: tạo cả tài khoản Firebase (đã xác minh email) để nhân viên đăng nhập được. */
  async create({ password, ...dto }: CreateAccountDto) {
    const email = dto.email.toLowerCase();
    await this.assertRoleUsable(dto.role);
    if (await this.users.exists({ email })) {
      throw new ConflictException('Email đã được sử dụng');
    }

    const firebaseUid = await this.firebase
      .createUser({ email, password, displayName: dto.fullName })
      .catch((error: { code?: string }) => {
        if (error.code === 'auth/email-already-exists') {
          throw new ConflictException('Email đã có tài khoản Firebase');
        }
        throw error;
      });

    try {
      const user = await this.users.create({
        ...dto,
        phone: dto.phone || undefined,
        email,
        ...(firebaseUid ? { firebaseUid } : {}),
        emailVerified: true,
      });
      return toAccount(user.toObject());
    } catch (error) {
      // Không để lại tài khoản Firebase thiếu tài khoản HMS.
      if (firebaseUid) await this.firebase.deleteUser(firebaseUid);
      if (isDuplicateKey(error)) {
        throw new ConflictException('Email đã được sử dụng');
      }
      throw error;
    }
  }

  /** UC43 Update Account. Khoá tài khoản chỉ đổi isActive, giữ nguyên dữ liệu liên quan (BR-RBAC-04). */
  async update(id: string, dto: UpdateAccountDto, currentUserId: string) {
    if (
      id === currentUserId &&
      (dto.role !== undefined || dto.isActive === false)
    ) {
      throw new BadRequestException(
        'Không thể tự đổi vai trò hoặc khoá tài khoản của chính mình',
      );
    }
    if (dto.role) await this.assertRoleUsable(dto.role);

    const user = isValidObjectId(id)
      ? await this.users
          .findByIdAndUpdate(id, toUpdate(dto), {
            new: true,
            runValidators: true,
          })
          .lean()
      : null;
    if (!user) throw new NotFoundException('Không tìm thấy tài khoản');
    return toAccount(user);
  }

  /** BR-RBAC-05: chỉ gán role đang tồn tại và đang dùng. */
  private async assertRoleUsable(code: string) {
    if (!(await this.roles.exists({ code, isActive: true }))) {
      throw new BadRequestException(
        `Vai trò ${code} không tồn tại hoặc đã ngừng dùng`,
      );
    }
  }
}
