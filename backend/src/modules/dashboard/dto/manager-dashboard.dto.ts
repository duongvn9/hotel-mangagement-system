import { ApiExtraModels, ApiProperty, getSchemaPath } from '@nestjs/swagger';
export class UnavailableDashboardBlock {
  @ApiProperty({ enum: [false] }) available: false;
  @ApiProperty({ enum: ['error', 'not_available'] }) reason:
    'error' | 'not_available';
}
class DashboardTaskCounts {
  @ApiProperty() assigned: number;
  @ApiProperty() inProgress: number;
  @ApiProperty() completed: number;
}
export class DashboardTasks {
  @ApiProperty({ enum: [true] }) available: true;
  @ApiProperty({ type: DashboardTaskCounts }) counts: DashboardTaskCounts;
  @ApiProperty() overdue: number;
}
export class DashboardRoomCounts {
  @ApiProperty() AVAILABLE: number;
  @ApiProperty() OCCUPIED: number;
  @ApiProperty() CLEANING: number;
  @ApiProperty() MAINTENANCE: number;
}
export class DashboardRooms {
  @ApiProperty({ enum: [true] }) available: true;
  @ApiProperty({ format: 'date-time' }) asOf: string;
  @ApiProperty() activeTotal: number;
  @ApiProperty({ type: DashboardRoomCounts }) byStatus: DashboardRoomCounts;
}
class DashboardRevenuePeriod {
  @ApiProperty() from: string;
  @ApiProperty() to: string;
  @ApiProperty({ enum: ['Asia/Ho_Chi_Minh'] }) timezone: string;
}
export class DashboardRevenue {
  @ApiProperty({ enum: [true] }) available: true;
  @ApiProperty({ type: DashboardRevenuePeriod }) period: DashboardRevenuePeriod;
  @ApiProperty() successCount: number;
  @ApiProperty() successAmount: number;
}
@ApiExtraModels(
  UnavailableDashboardBlock,
  DashboardTasks,
  DashboardRooms,
  DashboardRevenue,
)
export class ManagerDashboard {
  @ApiProperty({ format: 'date-time' }) generatedAt: string;
  @ApiProperty({
    oneOf: [
      { $ref: getSchemaPath(DashboardTasks) },
      { $ref: getSchemaPath(UnavailableDashboardBlock) },
    ],
  })
  tasks: DashboardTasks | UnavailableDashboardBlock;
  @ApiProperty({
    oneOf: [
      { $ref: getSchemaPath(DashboardRooms) },
      { $ref: getSchemaPath(UnavailableDashboardBlock) },
    ],
  })
  rooms: DashboardRooms | UnavailableDashboardBlock;
  @ApiProperty({
    oneOf: [
      { $ref: getSchemaPath(DashboardRevenue) },
      { $ref: getSchemaPath(UnavailableDashboardBlock) },
    ],
  })
  revenue: DashboardRevenue | UnavailableDashboardBlock;
}
