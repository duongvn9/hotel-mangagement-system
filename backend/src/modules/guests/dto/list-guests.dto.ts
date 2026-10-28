import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsString, Length, Max, Min } from 'class-validator';

const toInteger = ({ value }: { value: unknown }) =>
  typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class ListGuestsQuery {
  @ApiProperty({
    minLength: 2,
    maxLength: 100,
    description:
      'Literal search on guest name, email, phone or booking code (case insensitive)',
  })
  @Transform(trim)
  @IsString()
  @Length(2, 100)
  q: string;

  @ApiPropertyOptional({ default: 1, minimum: 1, maximum: 10000 })
  @Transform(toInteger)
  @IsInt()
  @Min(1)
  @Max(10000)
  page = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @Transform(toInteger)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}

export class GuestProfile {
  @ApiProperty({ description: 'Tên ở booking mới nhất của khách' })
  name: string;

  @ApiProperty({ description: 'Email dùng để nhận diện khách' })
  email: string;

  @ApiProperty({ description: 'Số điện thoại ở booking mới nhất của khách' })
  phone: string;

  @ApiProperty({ description: 'Khách từng đặt khi đã đăng nhập tài khoản' })
  hasAccount: boolean;

  @ApiProperty()
  totalBookings: number;

  @ApiProperty({ description: 'Số booking đã trả phòng' })
  completedStays: number;

  @ApiProperty({
    nullable: true,
    description: 'Ngày nhận phòng gần nhất, không tính booking đã huỷ',
  })
  lastCheckIn: string | null;
}

export class GuestListResponse {
  @ApiProperty({ type: [GuestProfile] })
  items: GuestProfile[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;
}
