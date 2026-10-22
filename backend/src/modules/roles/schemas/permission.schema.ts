import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

export type PermissionDocument = HydratedDocument<Permission>;

/** Quyền dùng một nhóm chức năng (collection `permissions`), gán cho Role ở UC45. */
@Schema({ timestamps: true })
export class Permission {
  /** Dạng `<tài nguyên>:<hành động>`, ví dụ 'room:manage'. */
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  code: string;

  @Prop({ required: true, trim: true })
  description: string;

  @Prop({ default: true })
  isActive: boolean;
}

export const PermissionSchema = SchemaFactory.createForClass(Permission);
