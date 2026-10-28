import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsEmail,
  IsInt,
  IsMongoId,
  IsOptional,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

/** Một dịch vụ khách chọn kèm khi đặt phòng. */
export class ServiceSelectionDto {
  @ApiProperty({ description: 'ObjectId của dịch vụ' })
  @IsMongoId()
  serviceId: string;

  @ApiProperty({ minimum: 1, description: 'Số lượng' })
  @IsInt()
  @Min(1)
  quantity: number;
}

/** Cấp hold khi khách bấm "Đặt phòng" (chưa cần thông tin liên hệ). */
export class HoldBookingDto {
  @ApiProperty({
    type: [String],
    description: 'Danh sách ObjectId phòng cần giữ',
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

  @ApiProperty({ minimum: 1, description: 'Số người lớn' })
  @IsInt()
  @Min(1)
  adultCount: number;

  @ApiProperty({ minimum: 0, default: 0, description: 'Số trẻ em' })
  @IsOptional()
  @IsInt()
  @Min(0)
  childCount: number = 0;
}

/** Nhập thông tin liên hệ cho hold hiện có (ROOM_HELD -> PENDING_DEPOSIT). */
export class SubmitBookingDetailsDto {
  @ApiProperty({ description: 'Mã giữ phòng nhận khi cấp hold' })
  @Matches(/^[A-Za-z0-9_-]{10,80}$/, { message: 'Invalid holdToken' })
  holdToken: string;

  @ApiProperty()
  @MaxLength(120)
  guestName: string;

  @ApiProperty()
  @IsEmail()
  @MaxLength(160)
  guestEmail: string;

  @ApiProperty({ description: 'Số điện thoại liên hệ' })
  @Matches(/^[0-9+\-\s]{6,20}$/, { message: 'guestPhone is invalid' })
  guestPhone: string;

  @ApiPropertyOptional({
    type: [ServiceSelectionDto],
    description:
      'Dịch vụ chọn kèm (tuỳ chọn); tự sinh đơn khi booking xác nhận',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ServiceSelectionDto)
  serviceSelections?: ServiceSelectionDto[];
}

/** Trả về cho client sau khi cấp hold. */
export class HoldResponse {
  @ApiProperty()
  bookingId: string;

  @ApiProperty()
  holdToken: string;

  @ApiProperty({ enum: ['ROOM_HELD'] })
  status: string;

  @ApiProperty({ type: [String] })
  rooms: string[];

  @ApiProperty()
  checkIn: string;

  @ApiProperty()
  checkOut: string;

  @ApiProperty()
  adultCount: number;

  @ApiProperty()
  childCount: number;

  @ApiProperty({ description: 'Tiền phòng (VND)' })
  roomTotal: number;

  @ApiProperty({ description: 'Tiền cọc cần thanh toán (VND)' })
  depositAmount: number;

  @ApiProperty({ description: 'Thời điểm giữ phòng hết hạn (ISO)' })
  holdExpiresAt: string;
}
