import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';
import { IssuePriority, IssueStatus } from '../schemas/issue.schema.js';

const toInteger = ({ value }: { value: unknown }) =>
  typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class ListIssuesQuery {
  @ApiPropertyOptional({ enum: IssueStatus })
  @IsOptional()
  @IsEnum(IssueStatus)
  status?: IssueStatus;

  @ApiPropertyOptional({ enum: IssuePriority })
  @IsOptional()
  @IsEnum(IssuePriority)
  priority?: IssuePriority;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, 100)
  category?: string;

  @ApiPropertyOptional({
    maxLength: 100,
    description: 'Literal title search, case insensitive',
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, 100)
  keyword?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1, maximum: 10000 })
  @Transform(toInteger)
  @IsInt()
  @Min(1)
  @Max(10000)
  page = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @Transform(toInteger)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}
