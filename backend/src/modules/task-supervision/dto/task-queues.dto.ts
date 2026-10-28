import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsMongoId,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TaskSourceType, TaskStatus } from '../../tasks/task-contract.js';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
export class TaskQueueFilters {
  @ApiPropertyOptional({ maxLength: 100 })
  @Transform(trim)
  @ValidateIf((_o, v) => v !== undefined)
  @IsString()
  @Matches(/\S/)
  @MaxLength(100)
  taskType?: string;
  @ApiPropertyOptional({ enum: TaskSourceType })
  @ValidateIf((_o, v) => v !== undefined)
  @IsEnum(TaskSourceType)
  sourceType?: TaskSourceType;
  @ApiPropertyOptional({
    maxLength: 100,
    description: 'Exact, case-sensitive free string; not a priority enum',
  })
  @Transform(trim)
  @ValidateIf((_o, v) => v !== undefined)
  @IsString()
  @Matches(/\S/)
  @MaxLength(100)
  priority?: string;
  @ApiPropertyOptional()
  @ValidateIf((_o, v) => v !== undefined)
  @IsMongoId()
  assigneeId?: string;
  @ApiPropertyOptional({ maxLength: 100 })
  @Transform(trim)
  @ValidateIf((_o, v) => v !== undefined)
  @IsString()
  @MaxLength(100)
  q?: string;
}
export class TaskQueueListQuery extends TaskQueueFilters {
  @ApiPropertyOptional({ enum: TaskStatus })
  @ValidateIf((_o, v) => v !== undefined)
  @IsEnum(TaskStatus)
  status?: TaskStatus;
  @ApiPropertyOptional({ type: Boolean })
  @Transform(({ value }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @ValidateIf((_o, v) => v !== undefined)
  @IsBoolean()
  overdue?: boolean;
  @ApiPropertyOptional({ default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(Math.floor(Number.MAX_SAFE_INTEGER / 100))
  page = 1;
  @ApiPropertyOptional({ default: 10, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 10;
  @ApiPropertyOptional({
    enum: ['assignedAt', 'dueAt', 'completedAt'],
    default: 'dueAt',
  })
  @IsIn(['assignedAt', 'dueAt', 'completedAt'])
  sortBy: 'assignedAt' | 'dueAt' | 'completedAt' = 'dueAt';
  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'asc' })
  @IsIn(['asc', 'desc'])
  sortOrder: 'asc' | 'desc' = 'asc';
}
export class QueueAssignee {
  @ApiProperty() id: string;
  @ApiProperty() fullName: string;
  @ApiProperty() role: string;
}
class QueueCounts {
  @ApiProperty() assigned: number;
  @ApiProperty() inProgress: number;
  @ApiProperty() completed: number;
  @ApiProperty({ description: 'Unexpected legacy statuses; normally zero' })
  other: number;
  @ApiProperty() total: number;
}
class QueueWorkload {
  @ApiProperty({ type: QueueAssignee, nullable: true })
  assignee: QueueAssignee | null;
  @ApiProperty() assigned: number;
  @ApiProperty() inProgress: number;
  @ApiProperty() completed: number;
  @ApiProperty() overdue: number;
}
class QueueFacets {
  @ApiProperty({
    type: [String],
    description:
      'Distinct values in management scope, independent of current filters',
  })
  taskTypes: string[];
  @ApiProperty({
    type: [String],
    description: 'Distinct exact priority strings in management scope',
  })
  priorities: string[];
}
export class TaskQueueSummary {
  @ApiProperty({ type: QueueCounts }) counts: QueueCounts;
  @ApiProperty() overdue: number;
  @ApiProperty({ type: [QueueWorkload] }) workload: QueueWorkload[];
  @ApiProperty({ type: QueueFacets }) facets: QueueFacets;
  @ApiProperty() generatedAt: string;
}
export class SupervisedTask {
  @ApiProperty() id: string;
  @ApiProperty() title: string;
  @ApiProperty() taskType: string;
  @ApiProperty({ type: String, nullable: true }) priority: string | null;
  @ApiProperty({
    description: 'Task status, including an unexpected legacy value if present',
  })
  status: string;
  @ApiProperty({ enum: TaskSourceType }) sourceType: TaskSourceType;
  @ApiProperty() sourceId: string;
  @ApiProperty({ type: QueueAssignee, nullable: true })
  assignee: QueueAssignee | null;
  @ApiProperty({ type: Date, nullable: true }) assignedAt: Date | null;
  @ApiProperty({ type: Date, nullable: true }) dueAt: Date | null;
  @ApiProperty({ type: Date, nullable: true }) completedAt: Date | null;
  @ApiProperty() overdue: boolean;
}
export class SupervisedTaskPage {
  @ApiProperty({ type: [SupervisedTask] }) items: SupervisedTask[];
  @ApiProperty() total: number;
  @ApiProperty() page: number;
  @ApiProperty() limit: number;
}
class MaintenanceRoomSummary {
  @ApiProperty() roomNumber: string;
}
class MaintenanceEquipmentSummary {
  @ApiProperty() assetCode: string;
  @ApiProperty() name: string;
}
class MaintenanceSourceSummary {
  @ApiProperty() description: string;
  @ApiProperty({ type: MaintenanceRoomSummary, nullable: true })
  room: MaintenanceRoomSummary | null;
  @ApiProperty({ type: MaintenanceEquipmentSummary, nullable: true })
  equipment: MaintenanceEquipmentSummary | null;
  @ApiProperty() preventsSafeUse: boolean;
}
class QueueSource {
  @ApiProperty({ enum: TaskSourceType }) sourceType: TaskSourceType;
  @ApiProperty() sourceId: string;
}
export class SupervisedTaskDetail extends SupervisedTask {
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'Only returned for COMPLETED tasks',
  })
  workResult?: string | null;
  @ApiPropertyOptional() createdAt?: Date;
  @ApiPropertyOptional() updatedAt?: Date;
  @ApiProperty({ type: QueueSource }) source: QueueSource;
  @ApiProperty({
    type: MaintenanceSourceSummary,
    nullable: true,
    description:
      'Only MAINTENANCE is expanded; other sources remain references',
  })
  sourceSummary: MaintenanceSourceSummary | null;
}
