import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsIn, IsString, Matches, ValidateIf } from 'class-validator';
import {
  PaymentMethod,
  PaymentPurpose,
} from '../../payments/schemas/payment-transaction.schema.js';

export class RevenueReportQuery {
  @ApiProperty({ example: '2026-10-01' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from: string;
  @ApiProperty({ example: '2026-10-25' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to: string;
  @ApiPropertyOptional({ enum: ['day', 'month'], default: 'day' })
  @IsIn(['day', 'month'])
  granularity: 'day' | 'month' = 'day';
  @ApiPropertyOptional({ enum: PaymentMethod })
  @ValidateIf((_o, value) => value !== undefined)
  @IsEnum(PaymentMethod)
  method?: PaymentMethod;
  @ApiPropertyOptional({ enum: PaymentPurpose })
  @ValidateIf((_o, value) => value !== undefined)
  @IsEnum(PaymentPurpose)
  purpose?: PaymentPurpose;
}
class RevenuePeriod {
  @ApiProperty() from: string;
  @ApiProperty() to: string;
  @ApiProperty({ enum: ['Asia/Ho_Chi_Minh'] }) timezone: string;
  @ApiProperty({ enum: ['day', 'month'] }) granularity: string;
}
class RevenueAnomalies {
  @ApiProperty() count: number;
}
class RevenueTotals {
  @ApiProperty() successCount: number;
  @ApiProperty() successAmount: number;
  @ApiProperty({
    type: 'object',
    nullable: true,
    additionalProperties: false,
    description: 'null: PaymentTransaction has no refund representation',
  })
  refunds: null;
  @ApiProperty({ example: false }) refundsSupported: boolean;
  @ApiProperty({ type: Number, nullable: true }) netAmount: number | null;
  @ApiProperty() failedCount: number;
  @ApiProperty() cancelledCount: number;
  @ApiProperty() pendingCount: number;
  @ApiProperty({ type: RevenueAnomalies }) anomalies: RevenueAnomalies;
}
class RevenueMethod {
  @ApiProperty({ enum: PaymentMethod }) method: PaymentMethod;
  @ApiProperty() successCount: number;
  @ApiProperty() successAmount: number;
}
class RevenuePurpose {
  @ApiProperty({ enum: PaymentPurpose }) purpose: PaymentPurpose;
  @ApiProperty() successCount: number;
  @ApiProperty() successAmount: number;
}
class RevenueBucket {
  @ApiProperty() bucket: string;
  @ApiProperty() successCount: number;
  @ApiProperty() successAmount: number;
}
export class RevenueReport {
  @ApiProperty({ type: RevenuePeriod }) period: RevenuePeriod;
  @ApiProperty({ type: RevenueTotals }) totals: RevenueTotals;
  @ApiProperty({ type: [RevenueMethod] }) byMethod: RevenueMethod[];
  @ApiProperty({ type: [RevenuePurpose] }) byPurpose: RevenuePurpose[];
  @ApiProperty({ type: [RevenueBucket] }) series: RevenueBucket[];
  @ApiProperty({ format: 'date-time' }) generatedAt: string;
}
