import { Transform } from 'class-transformer';
import { IsIn, IsString, Length, ValidateIf } from 'class-validator';
import { TaskStatus } from '../task-contract.js';

export class UnableToResolveDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(1, 2000)
  reason: string;
}

export class UpdateTaskProgressDto {
  @IsIn([TaskStatus.InProgress, TaskStatus.Completed])
  status!: TaskStatus.InProgress | TaskStatus.Completed;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @ValidateIf(
    (dto: UpdateTaskProgressDto) =>
      dto.status === TaskStatus.Completed || dto.workResult !== undefined,
  )
  @IsString()
  @Length(1, 2000)
  workResult?: string;
}
