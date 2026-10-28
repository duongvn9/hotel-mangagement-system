import { ApiExtraModels, ApiProperty, getSchemaPath } from '@nestjs/swagger';
import { UnavailableDashboardBlock } from './manager-dashboard.dto.js';

class ArrivalsSummary {
  @ApiProperty() total: number;
  /** Booking PENDING_DEPOSIT: khách đến nhưng chưa đặt cọc. */
  @ApiProperty() awaitingDeposit: number;
  /** Booking CONFIRMED: sẵn sàng nhận phòng. */
  @ApiProperty() ready: number;
  @ApiProperty() checkedIn: number;
}

class DeparturesSummary {
  @ApiProperty() total: number;
  /** Booking CHECKED_IN: đang ở, chờ trả phòng. */
  @ApiProperty() awaitingCheckOut: number;
  @ApiProperty() checkedOut: number;
}

export class ReceptionFrontDesk {
  @ApiProperty({ enum: [true] }) available: true;
  @ApiProperty({ description: 'Ngày làm việc YYYY-MM-DD (giờ Việt Nam)' })
  date: string;
  @ApiProperty({ type: ArrivalsSummary }) arrivals: ArrivalsSummary;
  @ApiProperty({ type: DeparturesSummary }) departures: DeparturesSummary;
}

export class ReceptionRooms {
  @ApiProperty({ enum: [true] }) available: true;
  @ApiProperty() date: string;
  @ApiProperty() total: number;
  @ApiProperty() free: number;
  @ApiProperty() held: number;
  @ApiProperty() reserved: number;
  @ApiProperty() inHouse: number;
  @ApiProperty() maintenance: number;
  @ApiProperty() cleaning: number;
}

export class ReceptionRequests {
  @ApiProperty({ enum: [true] }) available: true;
  @ApiProperty() serviceOrdersPendingReview: number;
  @ApiProperty() issuesPendingReview: number;
  @ApiProperty() feedbackUnreplied: number;
}

const block = (model: Function) => ({
  oneOf: [
    { $ref: getSchemaPath(model) },
    { $ref: getSchemaPath(UnavailableDashboardBlock) },
  ],
});

@ApiExtraModels(
  UnavailableDashboardBlock,
  ReceptionFrontDesk,
  ReceptionRooms,
  ReceptionRequests,
)
export class ReceptionDashboard {
  @ApiProperty({ format: 'date-time' }) generatedAt: string;
  @ApiProperty(block(ReceptionFrontDesk))
  frontDesk: ReceptionFrontDesk | UnavailableDashboardBlock;
  @ApiProperty(block(ReceptionRooms))
  rooms: ReceptionRooms | UnavailableDashboardBlock;
  @ApiProperty(block(ReceptionRequests))
  requests: ReceptionRequests | UnavailableDashboardBlock;
}
