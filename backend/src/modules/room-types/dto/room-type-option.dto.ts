import { ApiProperty } from '@nestjs/swagger';

export class RoomTypeOptionResponse {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
}
