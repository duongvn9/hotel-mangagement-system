import { ApiProperty } from '@nestjs/swagger';
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
