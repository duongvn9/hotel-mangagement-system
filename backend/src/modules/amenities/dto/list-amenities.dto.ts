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
export class ListAmenitiesQuery {
  @ApiPropertyOptional({ description: 'Literal case-insensitive name search' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @Transform(({ value }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
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
  @ApiPropertyOptional({ enum: ['name', 'createdAt'], default: 'name' })
  @IsIn(['name', 'createdAt'])
  sortBy: 'name' | 'createdAt' = 'name';
  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'asc' })
  @IsIn(['asc', 'desc'])
  sortOrder: 'asc' | 'desc' = 'asc';
}
