import { ASSET_PATH } from '../../../common/asset-path.js';
import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class RoomTypeBedDto {
  @ApiProperty({ description: 'BedType ObjectId (canonical lowercase)' })
  @Matches(/^[0-9a-f]{24}$/)
  bedTypeId: string;

  @ApiProperty({ minimum: 1, maximum: 20 })
  @IsInt()
  @Min(1)
  @Max(20)
  quantity: number;
}

export class CreateRoomTypeDto {
  @ApiPropertyOptional({ type: [String] })
  @ValidateIf((_object, value) => value !== undefined)
  @IsArray()
  @ArrayMaxSize(10)
  @Matches(ASSET_PATH, { each: true })
  images?: string[];

  @ApiProperty({ maxLength: 100 })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional()
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(trim)
  @IsString()
  description?: string;

  @ApiProperty({ minimum: 1, maximum: Number.MAX_SAFE_INTEGER })
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  adultCapacity: number;

  @ApiProperty({ minimum: 0, maximum: Number.MAX_SAFE_INTEGER })
  @IsInt()
  @Min(0)
  @Max(Number.MAX_SAFE_INTEGER)
  childCapacity: number;

  @ApiProperty({
    minimum: 1,
    maximum: Number.MAX_SAFE_INTEGER,
    description: 'Integer VND',
  })
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  basePrice: number;

  @ApiPropertyOptional({ type: [String], default: [] })
  @ValidateIf((_object, value) => value !== undefined)
  @IsArray()
  @ArrayUnique()
  @Matches(/^[0-9a-f]{24}$/, { each: true })
  amenities?: string[];

  @ApiPropertyOptional({ type: [RoomTypeBedDto], default: [] })
  @ValidateIf((_object, value) => value !== undefined)
  @IsArray()
  @ArrayMaxSize(20)
  @ArrayUnique((bed: RoomTypeBedDto) => bed.bedTypeId)
  @ValidateNested({ each: true })
  @Type(() => RoomTypeBedDto)
  beds?: RoomTypeBedDto[];

  @ApiPropertyOptional({ default: true })
  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateRoomTypeDto extends PartialType(CreateRoomTypeDto, {
  skipNullProperties: false,
}) {}
