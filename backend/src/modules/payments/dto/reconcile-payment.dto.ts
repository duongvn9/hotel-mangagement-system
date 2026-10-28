import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ReconcilePaymentDto {
  @ApiPropertyOptional({
    description:
      'Ghi chú xử lý đối soát (vd: đã hoàn tiền thủ công qua cổng VNPay)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

/** Một khoản tiền về muộn cần đối soát, kèm context booking để nhân viên xử lý. */
export class ReconciliationItem {
  @ApiProperty()
  id: string;

  @ApiProperty()
  transactionRef: string;

  @ApiProperty({ enum: ['DEPOSIT', 'FINAL'] })
  purpose: string;

  @ApiProperty({ description: 'Số tiền (VND nguyên)' })
  amount: number;

  @ApiPropertyOptional({ description: 'Mã giao dịch VNPay' })
  providerTransactionRef?: string;

  @ApiPropertyOptional({ description: 'Thời điểm tiền về' })
  paidAt?: Date;

  @ApiProperty({ description: 'ObjectId của booking liên quan' })
  bookingId: string;

  @ApiPropertyOptional({ description: 'Mã booking (vé)' })
  bookingCode?: string;

  @ApiPropertyOptional({ description: 'Trạng thái booking hiện tại' })
  bookingStatus?: string;

  @ApiProperty({ description: 'Thời điểm tạo payment' })
  createdAt: Date;
}

export class ReconciliationListResponse {
  @ApiProperty({ type: [ReconciliationItem] })
  items: ReconciliationItem[];

  @ApiProperty()
  total: number;
}

export class ReconciledPaymentResponse {
  @ApiProperty()
  id: string;

  @ApiProperty()
  transactionRef: string;

  @ApiProperty({ description: 'Cờ đối soát sau khi xử lý (false)' })
  needsReconciliation: boolean;

  @ApiProperty()
  reconciledAt: Date;

  @ApiProperty({ description: 'ObjectId của Manager đã xử lý' })
  reconciledBy: string;

  @ApiPropertyOptional()
  reconciliationNote?: string;
}
