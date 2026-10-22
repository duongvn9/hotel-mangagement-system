import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

export type RoleDocument = HydratedDocument<Role>;

/** Role trong RBAC (collection `roles`). User.role tham chiếu tới `code`. */
@Schema({ timestamps: true })
export class Role {
  /** Mã role, ví dụ 'MANAGER'. Không đổi được sau khi tạo (BR-RBAC-05). */
  @Prop({
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
    immutable: true,
  })
  code: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ trim: true })
  description?: string;

  /** 5 role trong SRS, không cho xoá hay khoá. */
  @Prop({ default: false })
  isSystem: boolean;

  /** Mã permission, ví dụ 'room:manage' (UC45). */
  @Prop({ type: [String], default: [] })
  permissions: string[];

  @Prop({ default: true })
  isActive: boolean;
}

export const RoleSchema = SchemaFactory.createForClass(Role);
