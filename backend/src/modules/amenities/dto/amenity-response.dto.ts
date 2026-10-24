import { ApiProperty } from '@nestjs/swagger';
export class AmenityRoomTypeResponse {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty() isActive: boolean;
}
export class AmenityResponse {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty() description: string;
  @ApiProperty() isActive: boolean;
  @ApiProperty({ type: [AmenityRoomTypeResponse] })
  roomTypes: AmenityRoomTypeResponse[];
  @ApiProperty() roomTypeCount: number;
}
export class AmenityListResponse {
  @ApiProperty({ type: [AmenityResponse] }) items: AmenityResponse[];
  @ApiProperty() total: number;
  @ApiProperty() page: number;
  @ApiProperty() limit: number;
}
