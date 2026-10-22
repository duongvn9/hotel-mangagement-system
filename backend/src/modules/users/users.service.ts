import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, type Model } from 'mongoose';
import type { UpdateProfileDto } from './dto/profile.dto.js';
import { User } from './schemas/user.schema.js';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private readonly users: Model<User>) {}

  /** UC04: chỉ sửa hồ sơ của chính mình. */
  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = isValidObjectId(userId)
      ? await this.users
          .findByIdAndUpdate(
            userId,
            { $set: dto },
            { new: true, runValidators: true },
          )
          .lean()
      : null;
    if (!user) throw new NotFoundException('Không tìm thấy tài khoản');
    return {
      id: String(user._id),
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      role: user.role,
    };
  }
}
