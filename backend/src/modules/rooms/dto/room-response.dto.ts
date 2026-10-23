import { ApiProperty } from '@nestjs/swagger';
import { RoomStatus } from '../../../common/constants/room-status.enum.js';

export class RoomTypeSummary {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty() isActive: boolean;
}

export class RoomResponse {
  @ApiProperty() id: string;
  @ApiProperty() roomNumber: string;
  @ApiProperty() floor: number;
  @ApiProperty({ type: RoomTypeSummary, nullable: true })
  roomType: RoomTypeSummary | null;
  @ApiProperty({ enum: RoomStatus }) status: RoomStatus;
  @ApiProperty() notes: string;
  @ApiProperty() isActive: boolean;
}

export class RoomListResponse {
  @ApiProperty({ type: [RoomResponse] }) items: RoomResponse[];
  @ApiProperty() total: number;
  @ApiProperty() page: number;
  @ApiProperty() limit: number;
}
