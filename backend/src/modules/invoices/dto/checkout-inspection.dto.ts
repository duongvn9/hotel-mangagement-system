import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsMongoId, IsOptional, IsString, MaxLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class RequestCheckoutInspectionDto {
  @ApiProperty({ description: 'Id nhân viên dịch vụ được giao kiểm tra' })
  @IsMongoId()
  assigneeId: string;

  @ApiPropertyOptional({
    maxLength: 500,
    description: 'Ghi chú của lễ tân cho người kiểm tra',
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class CheckoutInspectionView {
  taskId: string;
  /** ASSIGNED, IN_PROGRESS, COMPLETED hoặc CANCELLED (trạng thái task). */
  status: string;
  assigneeName: string;
  requestedAt: string;
  completedAt?: string;
  /** Kết quả nhân viên dịch vụ ghi khi hoàn thành. */
  workResult?: string;
}

export class CheckoutInspectionResponse {
  inspection: CheckoutInspectionView | null;
}

export class InspectorItem {
  id: string;
  fullName: string;
}

export class InspectorListResponse {
  items: InspectorItem[];
}
