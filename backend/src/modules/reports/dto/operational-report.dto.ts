import { ApiExtraModels, ApiProperty, getSchemaPath } from '@nestjs/swagger';
import { ReportPeriodQuery } from './report-period.dto.js';
export class OperationalReportQuery extends ReportPeriodQuery {}
export class OperationalUnavailable {
  @ApiProperty({ enum: [false] }) available: false;
  @ApiProperty({ enum: ['not_available'] }) reason: 'not_available';
}
export class OperationalBookings {
  @ApiProperty({ enum: [true] }) available: true;
  @ApiProperty() created: number;
  @ApiProperty() checkedIn: number;
  @ApiProperty() checkedOut: number;
  @ApiProperty() cancelled: number;
}
export class OperationalOccupancy {
  @ApiProperty({ enum: [true] }) available: true;
  @ApiProperty() occupiedRoomNights: number;
  @ApiProperty() availableRoomNights: number;
  @ApiProperty({ type: Number, nullable: true }) rate: number | null;
  @ApiProperty() note: string;
}
class RoomCounts {
  @ApiProperty() AVAILABLE: number;
  @ApiProperty() OCCUPIED: number;
  @ApiProperty() CLEANING: number;
  @ApiProperty() MAINTENANCE: number;
}
export class OperationalRooms {
  @ApiProperty({ enum: [true] }) available: true;
  @ApiProperty({ format: 'date-time' }) asOf: string;
  @ApiProperty() activeTotal: number;
  @ApiProperty({ type: RoomCounts }) byStatus: RoomCounts;
}
export class OperationalServiceOrders {
  @ApiProperty({ enum: [true] }) available: true;
  @ApiProperty() created: number;
  @ApiProperty({ type: 'object', additionalProperties: { type: 'integer' } })
  byReviewStatus: Record<string, number>;
  @ApiProperty({ type: 'object', additionalProperties: { type: 'integer' } })
  byExecutionStatus: Record<string, number>;
}
class CategoryCount {
  @ApiProperty() category: string;
  @ApiProperty() count: number;
}
export class OperationalIssues {
  @ApiProperty({ enum: [true] }) available: true;
  @ApiProperty() reported: number;
  @ApiProperty() closed: number;
  @ApiProperty({ type: 'object', additionalProperties: { type: 'integer' } })
  byStatus: Record<string, number>;
  @ApiProperty({ type: [CategoryCount] }) byCategory: CategoryCount[];
  @ApiProperty({ type: Number, nullable: true }) avgResolutionHours:
    number | null;
}
class MaintenanceCounts {
  @ApiProperty() ASSIGNED: number;
  @ApiProperty() IN_PROGRESS: number;
  @ApiProperty() COMPLETED: number;
  @ApiProperty() NO_ACTION: number;
}
export class OperationalMaintenance {
  @ApiProperty({ enum: [true] }) available: true;
  @ApiProperty() reported: number;
  @ApiProperty() preventsSafeUse: number;
  @ApiProperty() requiresAction: number;
  @ApiProperty({ type: MaintenanceCounts }) byStatus: MaintenanceCounts;
  @ApiProperty({
    description:
      'UC36 null status: missing/corrupt Task link; never coerced to a real status',
  })
  unknownStatus: number;
}
class TaskTypeCount {
  @ApiProperty() taskType: string;
  @ApiProperty() count: number;
}
class SourceTypeCount {
  @ApiProperty() sourceType: string;
  @ApiProperty() count: number;
}
class TaskPeriod {
  @ApiProperty() assigned: number;
  @ApiProperty() completed: number;
  @ApiProperty({ type: [TaskTypeCount] }) byTaskType: TaskTypeCount[];
  @ApiProperty({ type: [SourceTypeCount] }) bySourceType: SourceTypeCount[];
  @ApiProperty({ type: Number, nullable: true }) avgCompletionHours:
    number | null;
}
class TaskSnapshot {
  @ApiProperty({ format: 'date-time' }) asOf: string;
  @ApiProperty() assigned: number;
  @ApiProperty() inProgress: number;
  @ApiProperty() overdue: number;
}
export class OperationalTasks {
  @ApiProperty({ enum: [true] }) available: true;
  @ApiProperty({ type: TaskPeriod }) period: TaskPeriod;
  @ApiProperty({ type: TaskSnapshot }) snapshot: TaskSnapshot;
}
class OperationalPeriod {
  @ApiProperty() from: string;
  @ApiProperty() to: string;
  @ApiProperty({ enum: ['Asia/Ho_Chi_Minh'] }) timezone: string;
  @ApiProperty({ enum: ['day', 'month'] }) granularity: string;
  @ApiProperty() days: number;
}
export class OperationalBucket {
  @ApiProperty() bucket: string;
  @ApiProperty() bookingsCreated: number;
  @ApiProperty() checkIns: number;
  @ApiProperty() serviceOrdersCreated: number;
  @ApiProperty() issuesReported: number;
  @ApiProperty() maintenanceReported: number;
  @ApiProperty() tasksCompleted: number;
}
const schema = (type: Function) => ({
  oneOf: [
    { $ref: getSchemaPath(type) },
    { $ref: getSchemaPath(OperationalUnavailable) },
  ],
});
@ApiExtraModels(
  OperationalUnavailable,
  OperationalBookings,
  OperationalOccupancy,
  OperationalRooms,
  OperationalServiceOrders,
  OperationalIssues,
  OperationalMaintenance,
  OperationalTasks,
)
export class OperationalReport {
  @ApiProperty({ type: OperationalPeriod }) period: OperationalPeriod;
  @ApiProperty({ format: 'date-time' }) generatedAt: string;
  @ApiProperty() hasPeriodData: boolean;
  @ApiProperty(schema(OperationalBookings)) bookings:
    OperationalBookings | OperationalUnavailable;
  @ApiProperty(schema(OperationalOccupancy)) occupancy:
    OperationalOccupancy | OperationalUnavailable;
  @ApiProperty(schema(OperationalRooms)) roomsSnapshot:
    OperationalRooms | OperationalUnavailable;
  @ApiProperty(schema(OperationalServiceOrders)) serviceOrders:
    OperationalServiceOrders | OperationalUnavailable;
  @ApiProperty(schema(OperationalIssues)) issues:
    OperationalIssues | OperationalUnavailable;
  @ApiProperty(schema(OperationalMaintenance)) maintenance:
    OperationalMaintenance | OperationalUnavailable;
  @ApiProperty(schema(OperationalTasks)) tasks:
    OperationalTasks | OperationalUnavailable;
  @ApiProperty({ type: [OperationalBucket] }) series: OperationalBucket[];
}
