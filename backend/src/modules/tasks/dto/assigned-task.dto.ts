import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TaskSourceType, TaskStatus } from '../task-contract.js';
import type { Task } from '../schemas/task.schema.js';

export class AssignedTaskDto {
  blocked?: boolean;
  overdue?: boolean;
  blockerHistory?: Task['blockerHistory'];
  instructions?: string;
  continuationHistory?: Task['continuationHistory'];
  cancellation?: Task['cancellation'];

  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  taskType: string;

  @ApiProperty()
  priority: string;

  @ApiProperty({ enum: TaskStatus })
  status: TaskStatus;

  @ApiProperty({ format: 'date-time' })
  assignedAt: string;

  @ApiPropertyOptional({ format: 'date-time' })
  dueAt?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  completedAt?: string;

  @ApiPropertyOptional()
  workResult?: string;

  @ApiProperty({ enum: TaskSourceType })
  sourceType: TaskSourceType;

  @ApiProperty()
  sourceId: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'Unavailable: no authorized source-summary adapter is available',
  })
  sourceSummary: null;
}

export class AssignedTasksPageDto {
  @ApiProperty({ type: [AssignedTaskDto] })
  items: AssignedTaskDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;
}
