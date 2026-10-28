import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsString, Matches } from 'class-validator';
export class ReportPeriodQuery {
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
}
