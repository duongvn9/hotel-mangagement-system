import { ASSET_PATH } from '../../../common/asset-path.js';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  ArrayUnique,
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
export class CreateAmenityDto {
  @ApiPropertyOptional({ type: [String], maxItems: 1 })
  @ValidateIf((_object, value) => value !== undefined)
  @IsArray()
  @ArrayMaxSize(1)
  @ArrayUnique()
  @Matches(ASSET_PATH, { each: true })
  images?: string[];

  @ApiPropertyOptional({ type: String })
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @Matches(ASSET_PATH)
  iconUrl?: string;

  @ApiProperty({ maxLength: 100 })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;
  @ApiPropertyOptional({ default: '' })
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(trim)
  @IsString()
  description?: string;
  @ApiPropertyOptional({ default: true })
  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  isActive?: boolean;
  @ApiPropertyOptional({
    type: [String],
    default: [],
    description:
      'Target RoomType set; new assignments require active RoomTypes',
  })
  @ValidateIf((_object, value) => value !== undefined)
  @IsArray()
  @ArrayUnique()
  @Matches(/^[0-9a-f]{24}$/, { each: true })
  roomTypeIds?: string[];
}
export class UpdateAmenityDto extends PartialType(CreateAmenityDto, {
  skipNullProperties: false,
}) {}
