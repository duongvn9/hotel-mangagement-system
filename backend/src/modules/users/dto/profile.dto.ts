import { PartialType } from '@nestjs/swagger';
import { IsOptional, IsString, Length, Matches } from 'class-validator';

/** Thông tin hồ sơ người dùng tự nhập (UC01, UC04). */
export class ProfileDto {
  @IsString()
  @Length(2, 100)
  fullName: string;

  /** Số di động Việt Nam 10 chữ số, ví dụ 0901234567. */
  @IsOptional()
  @Matches(/^0\d{9}$/, {
    message: 'Số điện thoại phải gồm 10 chữ số, bắt đầu bằng 0',
  })
  phone?: string;
}

/** UC04: chỉ sửa được họ tên, số điện thoại. Gửi role, isActive, email... sẽ bị từ chối (BR-ACC-06). */
export class UpdateProfileDto extends PartialType(ProfileDto) {}
