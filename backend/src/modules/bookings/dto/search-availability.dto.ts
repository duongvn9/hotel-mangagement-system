import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsInt,
  IsMongoId,
  IsOptional,
  Matches,
  Min,
} from 'class-validator';
import { RoomTypeBedSummary } from './room-type-overview.dto.js';

/** Chấp nhận `?x=a&x=b` hoặc `?x=a,b`; bỏ phần tử rỗng. */
const toIdArray = ({ value }: { value: unknown }) =>
  Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',').filter(Boolean)
      : value;

/** Bộ lọc loại phòng dùng chung cho tìm phòng và danh sách công khai. */
export class RoomTypeFilterQuery {
  @ApiPropertyOptional({
    type: [String],
    description: 'Loại phòng phải có tất cả loại giường này (ObjectId)',
  })
  @IsOptional()
  @Transform(toIdArray)
  @IsArray()
  @ArrayUnique()
  @IsMongoId({ each: true })
  bedTypeIds?: string[];

  @ApiPropertyOptional({
    type: [String],
    description: 'Loại phòng phải có tất cả tiện nghi này (ObjectId)',
  })
  @IsOptional()
  @Transform(toIdArray)
  @IsArray()
  @ArrayUnique()
  @IsMongoId({ each: true })
  amenityIds?: string[];

  @ApiPropertyOptional({
    description: 'Đơn giá mỗi đêm tối thiểu (VND)',
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  priceMin?: number;

  @ApiPropertyOptional({
    description: 'Đơn giá mỗi đêm tối đa (VND)',
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  priceMax?: number;

  @ApiPropertyOptional({
    description: 'Sức chứa người lớn tối thiểu',
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  adults?: number;

  @ApiPropertyOptional({ description: 'Sức chứa trẻ em tối thiểu', minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  children?: number;
}

export class SearchAvailabilityDto extends RoomTypeFilterQuery {
  @ApiProperty({ description: 'Ngày nhận phòng (YYYY-MM-DD, giờ Việt Nam)' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'checkIn must be YYYY-MM-DD' })
  checkIn: string;

  @ApiProperty({ description: 'Ngày trả phòng (YYYY-MM-DD, giờ Việt Nam)' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'checkOut must be YYYY-MM-DD' })
  checkOut: string;

  @ApiProperty({ description: 'Số khách', minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  guests: number;

  @ApiPropertyOptional({ description: 'Lọc theo loại phòng (ObjectId)' })
  @IsOptional()
  @IsMongoId()
  roomTypeId?: string;
}

/** Dữ liệu phòng công khai trả cho khách; không lộ booking/customer. */
export class AvailableRoomResponse {
  @ApiProperty()
  id: string;

  @ApiProperty()
  roomTypeId: string;

  @ApiPropertyOptional({ description: 'Tên loại phòng để hiển thị' })
  roomTypeName?: string;

  @ApiPropertyOptional({ type: [RoomTypeBedSummary] })
  beds?: RoomTypeBedSummary[];

  @ApiPropertyOptional({ description: 'Đơn giá mỗi đêm (VND)' })
  pricePerNight?: number;

  @ApiProperty({ description: 'Sức chứa tối đa (người lớn + trẻ em)' })
  capacity: number;
}
