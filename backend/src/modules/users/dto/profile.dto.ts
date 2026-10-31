import { ASSET_PATH } from '../../../common/asset-path.js';
import { ValidateIf } from 'class-validator';
import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsOptional, IsString, Length, Matches } from 'class-validator';

/** Thông tin hồ sơ người dùng tự nhập (UC01, UC04). */
export class ProfileDto {
  @ApiPropertyOptional()
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @Matches(ASSET_PATH)
  avatarUrl?: string;

  @IsString()
  @Length(2, 100)
  fullName: string;

  /** Số di động Việt Nam 10 chữ số, ví dụ 0901234567. Khi sửa, gửi chuỗi rỗng để xoá số. */
  @IsOptional()
  @Matches(/^(0\d{9})?$/, {
    message: 'Số điện thoại phải gồm 10 chữ số, bắt đầu bằng 0',
  })
  phone?: string;
}

/** UC04: sửa họ tên, số điện thoại, avatar. Gửi role, isActive, email... sẽ bị từ chối (BR-ACC-06). */
export class UpdateProfileDto extends PartialType(ProfileDto) {}
