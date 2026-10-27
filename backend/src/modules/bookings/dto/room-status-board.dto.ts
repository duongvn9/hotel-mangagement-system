import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsInt,
  IsMongoId,
  IsOptional,
  Matches,
  Max,
  Min,
} from 'class-validator';

const toInteger = ({ value }: { value: unknown }) =>
  typeof value === 'string' && /^-?\d+$/.test(value) ? Number(value) : value;

export class RoomStatusBoardQuery {
  @ApiPropertyOptional({
    description: 'Ngày xem (YYYY-MM-DD, giờ Việt Nam), mặc định hôm nay',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be YYYY-MM-DD' })
  date?: string;

  @ApiPropertyOptional({ description: 'Chỉ xem một tầng' })
  @IsOptional()
  @Transform(toInteger)
  @IsInt()
  @Min(-10)
  @Max(200)
  floor?: number;

  @ApiPropertyOptional({ description: 'Chỉ xem một loại phòng (ObjectId)' })
  @IsOptional()
  @IsMongoId()
  roomTypeId?: string;
}
