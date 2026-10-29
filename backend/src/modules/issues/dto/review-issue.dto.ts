import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsISO8601,
  IsMongoId,
  IsString,
  MaxLength,
  Matches,
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

export class ContinueIssueDto {
  @IsMongoId()
  taskId: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsISO8601({ strict: true, strictSeparator: true })
  dueAt?: string;

  @ValidateIf((_, value) => value !== undefined)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  instructions?: string;
}

export class ReassignIssueDto {
  @IsMongoId()
  taskId: string;

  @IsMongoId()
  assigneeId: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  reason: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsISO8601({ strict: true, strictSeparator: true })
  dueAt?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Matches(/\S/)
  requestId: string;
}

export class AssignIssueDto {
  @IsMongoId()
  assigneeId: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsISO8601({ strict: true, strictSeparator: true })
  dueAt?: string;

  @ValidateIf((_, value) => value !== undefined)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  instructions?: string;
}
