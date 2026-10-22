import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';
import { Role } from '../../../common/constants/role.enum.js';

export type UserDocument = HydratedDocument<User>;

/** Tài khoản của Customer và nhân viên (collection `users`). */
@Schema({ timestamps: true })
export class User {
  /** UID bên Firebase Auth. Tài khoản seed hoặc do Manager tạo có thể chưa có. */
  @Prop({ unique: true, sparse: true })
  firebaseUid?: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true, trim: true })
  fullName: string;

  @Prop({ trim: true })
  phone?: string;

  /**
   * Mã role, ví dụ 'MANAGER'. Lưu mã (không lưu ObjectId) để guard so sánh với @Roles()
   * mà không cần đọc DB. Không giới hạn trong enum Role vì Manager tạo thêm role ở UC46.
   */
  @Prop({ required: true, default: Role.Customer, index: true })
  role: string;

  @Prop({ default: true })
  isActive: boolean;
}

export const UserSchema = SchemaFactory.createForClass(User);
