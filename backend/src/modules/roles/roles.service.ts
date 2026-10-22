import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, type Model } from 'mongoose';
import { User } from '../users/schemas/user.schema.js';
import type {
  CreateRoleDto,
  SetPermissionsDto,
  UpdateRoleDto,
} from './dto/role.dto.js';
import { Permission } from './schemas/permission.schema.js';
import { Role } from './schemas/role.schema.js';

type LeanRole = Role & { _id: unknown };

const toRole = (role: LeanRole, userCount = 0) => ({
  id: String(role._id),
  code: role.code,
  name: role.name,
  description: role.description,
  isSystem: role.isSystem,
  isActive: role.isActive,
  permissions: role.permissions,
  userCount,
});

/** So sánh tên role không phân biệt hoa thường, dấu vẫn tính. */
const NAME_COLLATION = { locale: 'vi', strength: 2 };

@Injectable()
export class RolesService {
  constructor(
    @InjectModel(Role.name) private readonly roles: Model<Role>,
    @InjectModel(Permission.name)
    private readonly permissions: Model<Permission>,
    @InjectModel(User.name) private readonly users: Model<User>,
  ) {}

  /** UC44 View Role List, kèm số tài khoản đang dùng mỗi role. */
  async list() {
    const [roles, counts] = await Promise.all([
      this.roles.find().sort({ isSystem: -1, code: 1 }).lean(),
      this.users.aggregate<{ _id: string; count: number }>([
        { $group: { _id: '$role', count: { $sum: 1 } } },
      ]),
    ]);
    const countByRole = new Map(counts.map((c) => [c._id, c.count]));
    return roles.map((r) => toRole(r, countByRole.get(r.code)));
  }

  async findOne(id: string) {
    const role = await this.getRole(id);
    return toRole(role, await this.users.countDocuments({ role: role.code }));
  }

  /** Permission để chọn ở UC45. */
  listPermissions() {
    return this.permissions
      .find({ isActive: true })
      .sort({ code: 1 })
      .select('-_id code description')
      .lean();
  }

  /** UC46 Create Role. */
  async create(dto: CreateRoleDto) {
    if (await this.roles.exists({ code: dto.code })) {
      throw new ConflictException(`Mã role ${dto.code} đã tồn tại`);
    }
    await this.assertNameFree(dto.name);
    try {
      const role = await this.roles.create({ ...dto, isSystem: false });
      return toRole(role.toObject());
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        throw new ConflictException(`Mã role ${dto.code} đã tồn tại`);
      }
      throw error;
    }
  }

  /** UC46 Update Role. */
  async update(id: string, dto: UpdateRoleDto) {
    const role = await this.getRole(id);
    if (dto.name) await this.assertNameFree(dto.name, id);
    if (dto.isActive === false) {
      if (role.isSystem) {
        throw new BadRequestException('Không thể ngừng dùng role hệ thống');
      }
      // BR-RBAC-05: tài khoản đang dùng role này sẽ mất quyền nếu role bị tắt.
      const inUse = await this.users.countDocuments({
        role: role.code,
        isActive: true,
      });
      if (inUse > 0) {
        throw new ConflictException(
          `Còn ${inUse} tài khoản đang dùng role ${role.code}, hãy đổi role cho họ trước`,
        );
      }
    }
    const updated = await this.roles
      .findByIdAndUpdate(id, { $set: dto }, { new: true, runValidators: true })
      .lean();
    return toRole(updated ?? role);
  }

  /** UC45 Assign Permissions. */
  async setPermissions(id: string, { permissions }: SetPermissionsDto) {
    await this.getRole(id);
    const valid = await this.permissions
      .find({ code: { $in: permissions }, isActive: true })
      .distinct('code');
    const invalid = permissions.filter((code) => !valid.includes(code));
    if (invalid.length) {
      throw new BadRequestException(
        `Permission không hợp lệ: ${invalid.join(', ')}`,
      );
    }
    const updated = await this.roles
      .findByIdAndUpdate(id, { $set: { permissions } }, { new: true })
      .lean();
    if (!updated) throw new NotFoundException('Không tìm thấy role');
    return toRole(updated);
  }

  private async getRole(id: string) {
    const role = isValidObjectId(id)
      ? await this.roles.findById(id).lean()
      : null;
    if (!role) throw new NotFoundException('Không tìm thấy role');
    return role;
  }

  private async assertNameFree(name: string, exceptId?: string) {
    const clash = await this.roles
      .findOne({
        name: name.trim(),
        ...(exceptId ? { _id: { $ne: exceptId } } : {}),
      })
      .collation(NAME_COLLATION)
      .lean();
    if (clash) throw new ConflictException(`Tên role "${name}" đã tồn tại`);
  }
}
