import { ApiPropertyOptional, PartialType, PickType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ProfileDto } from './profile.dto.js';

/** UC42: tìm theo tên, email, số điện thoại; lọc theo role, trạng thái. */
export class ListAccountsQuery {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsString()
  role?: string;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @Transform(({ value }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}

/** UC43 Create Account. */
export class CreateAccountDto extends ProfileDto {
  @IsEmail({}, { message: 'Email không hợp lệ' })
  email: string;

  @IsString()
  role: string;

  /** Mật khẩu ban đầu của tài khoản Firebase, Manager báo cho nhân viên. */
  @IsString()
  @Length(6, 128)
  password: string;
}

/** UC43 Update Account: không đổi email (định danh đăng nhập) và mật khẩu ở đây. */
export class UpdateAccountDto extends PartialType(
  PickType(CreateAccountDto, [
    'fullName',
    'phone',
    'role',
    'avatarUrl',
  ] as const),
) {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
