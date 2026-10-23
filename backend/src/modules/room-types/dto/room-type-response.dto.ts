import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RoomTypeAmenityResponse {
  @ApiPropertyOptional({
    description: 'Included in create/update/detail responses for the editor',
  })
  isActive?: boolean;
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;
}

export class RoomTypeResponse {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  description: string;

  @ApiProperty({ minimum: 1 })
  capacity: number;

  @ApiProperty({ description: 'Integer VND, greater than zero' })
  basePrice: number;

  @ApiProperty({ type: [RoomTypeAmenityResponse] })
  amenities: RoomTypeAmenityResponse[];

  @ApiProperty()
  isActive: boolean;

  @ApiProperty({
    description:
      'Derived validity and active flag, not date-based room inventory',
  })
  availableForBooking: boolean;
}

export class RoomTypeListResponse {
  @ApiProperty({ type: [RoomTypeResponse] })
  items: RoomTypeResponse[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;
}
