import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsMongoId, IsOptional, Matches, Min } from 'class-validator';

export class SearchAvailabilityDto {
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

  @ApiProperty({ description: 'Sức chứa tối đa (người lớn + trẻ em)' })
  capacity: number;
}
