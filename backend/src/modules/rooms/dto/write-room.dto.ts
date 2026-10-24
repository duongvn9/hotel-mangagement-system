import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsString,
  Matches,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { RoomStatus } from '../../../common/constants/room-status.enum.js';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateRoomDto {
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  roomNumber: string;

  @ApiProperty({
    description: 'Safe integer; basement and ground floors allowed',
  })
  @IsInt()
  @Min(Number.MIN_SAFE_INTEGER)
  @Max(Number.MAX_SAFE_INTEGER)
  floor: number;

  @ApiProperty({ description: 'Canonical ObjectId of an active RoomType' })
  @IsString()
  @Matches(/^[0-9a-f]{24}$/)
  roomType: string;

  @ApiPropertyOptional({ enum: RoomStatus, default: RoomStatus.Available })
  @ValidateIf((_object, value) => value !== undefined)
  @IsEnum(RoomStatus)
  status?: RoomStatus;

  @ApiPropertyOptional({ default: '' })
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(trim)
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ default: true })
  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateRoomDto extends PartialType(CreateRoomDto, {
  skipNullProperties: false,
}) {}
