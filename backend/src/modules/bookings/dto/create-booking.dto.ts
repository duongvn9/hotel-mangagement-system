import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsEmail,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateBookingDto {
  @ApiProperty({
    type: [String],
    description: 'Danh sách ObjectId phòng cần đặt',
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsMongoId({ each: true })
  rooms: string[];

  @ApiProperty({ description: 'Ngày nhận phòng (YYYY-MM-DD, giờ Việt Nam)' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'checkIn must be YYYY-MM-DD' })
  checkIn: string;

  @ApiProperty({ description: 'Ngày trả phòng (YYYY-MM-DD, giờ Việt Nam)' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'checkOut must be YYYY-MM-DD' })
  checkOut: string;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  guests: number;

  @ApiProperty()
  @IsString()
  @MaxLength(120)
  guestName: string;

  @ApiProperty()
  @IsEmail()
  @MaxLength(160)
  guestEmail: string;

  @ApiProperty({ description: 'Số điện thoại liên hệ' })
  @Matches(/^[0-9+\-\s]{6,20}$/, { message: 'guestPhone is invalid' })
  guestPhone: string;
}

/** UC11: mọi trường đều tùy chọn, chỉ trường nào gửi lên mới được đổi. */
export class UpdateBookingDto {
  @ApiPropertyOptional({
    type: [String],
    description: 'Danh sách ObjectId phòng mới (thay toàn bộ phòng hiện tại)',
  })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsMongoId({ each: true })
  rooms?: string[];

  @ApiPropertyOptional({ description: 'Ngày nhận phòng (YYYY-MM-DD, giờ VN)' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'checkIn must be YYYY-MM-DD' })
  checkIn?: string;

  @ApiPropertyOptional({ description: 'Ngày trả phòng (YYYY-MM-DD, giờ VN)' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'checkOut must be YYYY-MM-DD' })
  checkOut?: string;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  guests?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  guestName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  @MaxLength(160)
  guestEmail?: string;

  @ApiPropertyOptional({ description: 'Số điện thoại liên hệ' })
  @IsOptional()
  @Matches(/^[0-9+\-\s]{6,20}$/, { message: 'guestPhone is invalid' })
  guestPhone?: string;
}

export class UpdatedBookingResponse {
  @ApiProperty()
  id: string;

  @ApiProperty()
  code: string;

  @ApiProperty({ enum: ['PENDING_DEPOSIT', 'CONFIRMED'] })
  status: string;

  @ApiProperty({ type: [String] })
  rooms: string[];

  @ApiProperty()
  checkIn: string;

  @ApiProperty()
  checkOut: string;

  @ApiProperty()
  guests: number;

  @ApiProperty()
  guestName: string;

  @ApiProperty()
  guestEmail: string;

  @ApiProperty()
  guestPhone: string;

  @ApiProperty({ description: 'Tiền phòng (VND)' })
  roomTotal: number;

  @ApiProperty({ description: 'Tiền cọc (VND)' })
  depositAmount: number;
}

export class CancelBookingDto {
  @ApiProperty({
    required: false,
    description: 'Mã booking (vé) cho Guest chưa đăng nhập',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  code?: string;
}

export class BookingResponse {
  @ApiProperty()
  id: string;

  @ApiProperty()
  code: string;

  @ApiProperty({ enum: ['PENDING_DEPOSIT'] })
  status: string;

  @ApiProperty({ type: [String] })
  rooms: string[];

  @ApiProperty()
  checkIn: string;

  @ApiProperty()
  checkOut: string;

  @ApiProperty()
  guests: number;

  @ApiProperty({ description: 'Tiền phòng (VND)' })
  roomTotal: number;

  @ApiProperty({ description: 'Tiền cọc cần thanh toán (VND)' })
  depositAmount: number;

  @ApiProperty({ description: 'Thời điểm giữ phòng hết hạn nếu chưa đặt cọc' })
  holdExpiresAt: string;
}

export class WalkInBookingResponse {
  @ApiProperty()
  id: string;

  @ApiProperty()
  code: string;

  @ApiProperty({ enum: ['CONFIRMED'] })
  status: string;

  @ApiProperty({ type: [String] })
  rooms: string[];

  @ApiProperty()
  checkIn: string;

  @ApiProperty()
  checkOut: string;

  @ApiProperty()
  guests: number;

  @ApiProperty({ description: 'Tiền phòng (VND)' })
  roomTotal: number;
}
