import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TaskStatus } from '../../tasks/task-contract.js';

export const HISTORY_STATUSES = [
  ...Object.values(TaskStatus),
  'NO_ACTION',
] as const;
export type HistoryStatus = TaskStatus | 'NO_ACTION' | null;
export class MaintenanceHistoryQuery {
  @ApiPropertyOptional({ maxLength: 100 })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @ValidateIf((_o, value) => value !== undefined)
  @IsString()
  @MaxLength(100)
  q?: string;
  @ApiPropertyOptional({ enum: HISTORY_STATUSES })
  @ValidateIf((_o, value) => value !== undefined)
  @IsIn(HISTORY_STATUSES)
  status?: Exclude<HistoryStatus, null>;
  @ApiPropertyOptional({ example: '2026-10-25' })
  @ValidateIf((_o, value) => value !== undefined)
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from?: string;
  @ApiPropertyOptional({ example: '2026-10-25' })
  @ValidateIf((_o, value) => value !== undefined)
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to?: string;
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
    enum: ['asc', 'desc'],
    default: 'desc',
    description: 'Sort by reportedAt (Maintenance.createdAt), then id',
  })
  @IsIn(['asc', 'desc'])
  sort: 'asc' | 'desc' = 'desc';
}
class HistoryRoom {
  @ApiProperty() id: string;
  @ApiProperty() roomNumber: string;
  @ApiProperty() floor: number;
}
class HistoryEquipment {
  @ApiPropertyOptional() imageUrl?: string;
  @ApiProperty() id: string;
  @ApiProperty() assetCode: string;
  @ApiProperty() name: string;
  @ApiPropertyOptional() category?: string;
  @ApiPropertyOptional() location?: string;
}
class HistoryTarget {
  @ApiProperty({ type: HistoryRoom, nullable: true }) room: HistoryRoom | null;
  @ApiProperty({ type: HistoryEquipment, nullable: true })
  equipment: HistoryEquipment | null;
  @ApiProperty({ type: String, nullable: true }) facilityLocation:
    string | null;
}
class HistoryPerson {
  @ApiProperty() id: string;
  @ApiProperty() fullName: string;
}
class HistoryTask {
  @ApiProperty() id: string;
  @ApiProperty() title: string;
  @ApiProperty() priority: string;
  @ApiProperty({ enum: TaskStatus }) status: TaskStatus;
  @ApiProperty({ type: HistoryPerson }) assignee: HistoryPerson;
  @ApiProperty() assignedAt: Date;
  @ApiPropertyOptional() dueAt?: Date;
  @ApiPropertyOptional() completedAt?: Date;
  @ApiPropertyOptional() workResult?: string;
}
export class MaintenanceHistoryItem {
  @ApiProperty() id: string;
  @ApiProperty() reportedAt: Date;
  @ApiProperty({ description: 'Full description; UI truncates visually' })
  description: string;
  @ApiProperty({ type: HistoryTarget }) target: HistoryTarget;
  @ApiProperty() requiresAction: boolean;
  @ApiProperty() preventsSafeUse: boolean;
  @ApiProperty({
    enum: HISTORY_STATUSES,
    nullable: true,
    description:
      'null = missing or invalid linked Task; never inferred from receipt',
  })
  status: HistoryStatus;
  @ApiPropertyOptional() completedAt?: Date;
}
export class MaintenanceHistoryPage {
  @ApiProperty({ type: [MaintenanceHistoryItem] })
  items: MaintenanceHistoryItem[];
  @ApiProperty() total: number;
  @ApiProperty() page: number;
  @ApiProperty() limit: number;
}
export class MaintenanceHistoryDetail extends MaintenanceHistoryItem {
  @ApiProperty({ type: HistoryPerson }) reportedBy: HistoryPerson;
  @ApiProperty({ type: HistoryTask, nullable: true }) task: HistoryTask | null;
}
