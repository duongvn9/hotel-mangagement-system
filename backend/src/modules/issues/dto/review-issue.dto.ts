import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsISO8601,
  IsMongoId,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { HandlingCategory, IssuePriority } from '../schemas/issue.schema.js';

export class ReviewIssueDto {
  @IsEnum(HandlingCategory)
  handlingCategory: HandlingCategory;

  @IsEnum(IssuePriority)
  priority: IssuePriority;

  @IsBoolean()
  needsStaffAction: boolean;

  @ValidateIf((_, value) => value !== undefined)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class CloseIssueDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  conclusion: string;
}

export class AssignIssueDto {
  @IsMongoId()
  assigneeId: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsISO8601({ strict: true, strictSeparator: true })
  dueAt?: string;
}
