import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const booleanQuery = ({ value }: { value: unknown }) =>
  value === 'true' ? true : value === 'false' ? false : value;
export class ListServicesQuery {
  @ApiPropertyOptional({
    description: 'Literal case-insensitive name search',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @Transform(booleanQuery)
  @IsBoolean()
  billable?: boolean;

  @ApiPropertyOptional({
    type: Boolean,
    description: 'Omit to include active and inactive services',
  })
  @IsOptional()
  @Transform(booleanQuery)
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 10, minimum: 1, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 10;

  @ApiPropertyOptional({
    enum: ['name', 'price', 'createdAt'],
    default: 'name',
  })
  @IsIn(['name', 'price', 'createdAt'])
  sortBy: 'name' | 'price' | 'createdAt' = 'name';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'asc' })
  @IsIn(['asc', 'desc'])
  sortOrder: 'asc' | 'desc' = 'asc';
}
