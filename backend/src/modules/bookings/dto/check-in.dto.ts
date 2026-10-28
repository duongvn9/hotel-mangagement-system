import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsMongoId,
  IsOptional,
  ValidateNested,
} from 'class-validator';

export class RoomReplacementDto {
  @ApiProperty({
    description: 'Phòng đang thuộc booking cần đổi đi (ObjectId)',
  })
  @IsMongoId()
  from: string;

  @ApiProperty({
    description: 'Phòng thay thế: cùng loại phòng, sẵn sàng và còn trống',
  })
  @IsMongoId()
  to: string;
}

export class CheckInDto {
  @ApiPropertyOptional({
    type: [RoomReplacementDto],
    description:
      'Đổi phòng chưa sẵn sàng sang phòng khác cùng loại ngay lúc check-in (giá không đổi)',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => RoomReplacementDto)
  replacements?: RoomReplacementDto[];
}

export class CheckInResult {
  id: string;
  code: string;
  status: string;
  checkedInAt: string;
  rooms: { id: string; roomNumber: string }[];
}

export class CheckInReplacementOption {
  id: string;
  roomNumber: string;
  floor: number;
}

export class CheckInRoomOption {
  id: string;
  roomNumber: string;
  roomTypeName: string;
  /** Phòng đang hoạt động và có trạng thái vật lý AVAILABLE. */
  ready: boolean;
  /** Trạng thái vật lý, hoặc INACTIVE nếu phòng bị vô hiệu hoá. */
  status: string;
  /** Phòng thay thế hợp lệ; rỗng nếu phòng đã sẵn sàng. */
  replacements: CheckInReplacementOption[];
}

export class CheckInOptionsResponse {
  bookingId: string;
  code: string;
  rooms: CheckInRoomOption[];
}
