import { ApiProperty } from '@nestjs/swagger';
export class ServiceResponse {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty() description: string;
  @ApiProperty({
    description: 'Optional billing unit, empty string when unspecified',
  })
  unit: string;
  @ApiProperty() billable: boolean;
  @ApiProperty({
    type: Number,
    nullable: true,
    minimum: 0,
    description: 'Current integer VND price; null when not configured',
  })
  price: number | null;
  @ApiProperty() isActive: boolean;
}
export class ServiceListResponse {
  @ApiProperty({ type: [ServiceResponse] }) items: ServiceResponse[];
  @ApiProperty() total: number;
  @ApiProperty() page: number;
  @ApiProperty() limit: number;
}
