import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsMongoId,
  IsString,
  Length,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
export class ReportFaultDto {
  @ApiPropertyOptional()
  @ValidateIf((_o, v) => v !== undefined)
  @IsMongoId()
  roomId?: string;
  @ApiPropertyOptional()
  @ValidateIf((_o, v) => v !== undefined)
  @IsMongoId()
  equipmentId?: string;
  @ApiPropertyOptional({ maxLength: 200 })
  @Transform(trim)
  @ValidateIf((_o, v) => v !== undefined)
  @IsString()
  @Length(1, 200)
  facilityLocation?: string;
  @ApiProperty({ maxLength: 2000 })
  @Transform(trim)
  @IsString()
  @Length(1, 2000)
  description: string;
  @ApiPropertyOptional({ default: true }) @IsBoolean() requiresAction = true;
  @ApiPropertyOptional({ default: false }) @IsBoolean() preventsSafeUse = false;
}
export class MaintenanceTargetsQuery {
  @ApiPropertyOptional({ maxLength: 100 })
  @Transform(trim)
  @ValidateIf((_o, v) => v !== undefined)
  @IsString()
  @Length(0, 100)
  q?: string;
}
export class ReportReceipt {
  @ApiProperty() reportId: string;
  @ApiPropertyOptional() taskId?: string;
  @ApiProperty() roomMarkedUnavailable: boolean;
  @ApiProperty({ type: [String] }) warnings: string[];
}
class RoomTarget {
  @ApiProperty() id: string;
  @ApiProperty() roomNumber: string;
  @ApiProperty() floor: number;
  @ApiProperty() status: string;
}
class EquipmentTarget {
  @ApiProperty() id: string;
  @ApiProperty() assetCode: string;
  @ApiProperty() name: string;
  @ApiProperty() category: string;
  @ApiProperty() location: string;
  @ApiProperty({ nullable: true, type: String }) roomId: string | null;
  @ApiProperty({ nullable: true, type: String }) roomNumber: string | null;
}
export class MaintenanceTargets {
  @ApiProperty({ type: [RoomTarget] }) rooms: RoomTarget[];
  @ApiProperty({ type: [EquipmentTarget] }) equipment: EquipmentTarget[];
}
