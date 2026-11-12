import { ApiProperty } from '@nestjs/swagger';

export class BedTypeRoomTypeResponse {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty() isActive: boolean;
}

export class BedTypeResponse {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty() description: string;
  @ApiProperty() isActive: boolean;
  @ApiProperty({
    type: [BedTypeRoomTypeResponse],
    description: 'Room types that use this bed type (read only)',
  })
  roomTypes: BedTypeRoomTypeResponse[];
  @ApiProperty() roomTypeCount: number;
}

export class BedTypeListResponse {
  @ApiProperty({ type: [BedTypeResponse] }) items: BedTypeResponse[];
  @ApiProperty() total: number;
  @ApiProperty() page: number;
  @ApiProperty() limit: number;
}
