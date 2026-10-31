import { ASSET_PATH } from '../../../common/asset-path.js';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  Matches,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
export class CreateServiceDto {
  @ApiPropertyOptional({
    type: String,
    description: 'Image asset path; empty string clears the image',
  })
  @ValidateIf((_object, value) => value !== undefined && value !== '')
  @IsString()
  @Matches(ASSET_PATH)
  imageUrl?: string;

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
  @ApiPropertyOptional({ default: '' })
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(trim)
  @IsString()
  unit?: string;
  @ApiPropertyOptional({ default: true })
  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  billable?: boolean;
  @ApiPropertyOptional({
    type: 'integer',
    nullable: true,
    minimum: 0,
    maximum: Number.MAX_SAFE_INTEGER,
    default: null,
    description:
      'Required when the resulting service is billable and active; zero is valid',
  })
  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsInt()
  @Min(0)
  @Max(Number.MAX_SAFE_INTEGER)
  price?: number | null;
  @ApiPropertyOptional({ default: true })
  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  isActive?: boolean;
}
export class UpdateServiceDto extends PartialType(CreateServiceDto, {
  skipNullProperties: false,
}) {}
