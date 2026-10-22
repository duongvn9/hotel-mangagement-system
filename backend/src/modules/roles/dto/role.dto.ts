import { PartialType, PickType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

/** UC46 Create Role. */
export class CreateRoleDto {
  /** Mã role, ví dụ HOUSEKEEPING. Không đổi được sau khi tạo (BR-RBAC-05). */
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @Matches(/^[A-Z][A-Z0-9_]{2,31}$/, {
    message:
      'Mã role gồm 3-32 ký tự A-Z, 0-9, dấu gạch dưới và bắt đầu bằng chữ cái',
  })
  code: string;

  @IsString()
  @Length(2, 60)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;
}

/** UC46 Update Role: không có `code`. */
export class UpdateRoleDto extends PartialType(
  PickType(CreateRoleDto, ['name', 'description'] as const),
) {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/** UC45 Assign Permissions: danh sách đầy đủ permission của role sau khi sửa. */
export class SetPermissionsDto {
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  permissions: string[];
}
