import { Transform } from 'class-transformer';
import {
  MinLength,
  MaxLength,
  IsDateString,
  IsEnum,
  IsMongoId,
  IsString,
  Matches,
  ValidateIf,
} from 'class-validator';
import { TaskSourceType } from '../task-contract.js';

export class CreateTaskDto {
  @IsString()
  @Matches(/\S/)
  title: string;

  @IsString()
  @Matches(/\S/)
  taskType: string;

  @IsString()
  @Matches(/\S/)
  priority: string;

  @IsEnum(TaskSourceType)
  sourceType: TaskSourceType;

  @IsMongoId()
  sourceId: string;

  @IsMongoId()
  assigneeId: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsDateString({ strict: true })
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
