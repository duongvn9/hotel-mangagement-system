import { IsDateString, IsEnum, IsMongoId, IsString, Matches, ValidateIf } from 'class-validator';
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
}
