import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsMongoId,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class InitiatePaymentDto {
  @ApiProperty({ description: 'ObjectId của booking cần thanh toán' })
  @IsMongoId()
  bookingId: string;

  @ApiPropertyOptional({
    enum: ['vn', 'en'],
    description: 'Ngôn ngữ trang VNPay',
  })
  @IsOptional()
  @IsIn(['vn', 'en'])
  locale?: 'vn' | 'en';

  @ApiPropertyOptional({ description: 'Mã ngân hàng chọn sẵn trên VNPay' })
  @IsOptional()
  @Matches(/^[A-Za-z0-9]{3,20}$/)
  bankCode?: string;

  @ApiPropertyOptional({
    description: 'Mã booking (vé) cho Guest chưa đăng nhập tự thanh toán',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  code?: string;
}

export class PaymentInitiationResponse {
  @ApiProperty({ description: 'Mã giao dịch nội bộ (vnp_TxnRef)' })
  transactionRef: string;

  @ApiProperty({ description: 'URL redirect sang cổng VNPay' })
  paymentUrl: string;

  @ApiProperty({ description: 'Số tiền thanh toán (VND nguyên)' })
  amount: number;
}

/** Kết quả xác minh trang Return, chỉ để hiển thị; không phải bằng chứng thanh toán. */
export class PaymentReturnResponse {
  @ApiProperty()
  transactionRef: string;

  @ApiProperty({ enum: ['PENDING', 'SUCCESS', 'FAILED', 'CANCELLED'] })
  status: string;

  @ApiProperty()
  responseCode: string;

  @ApiProperty({ description: 'Booking của giao dịch, để đọc lại trạng thái' })
  bookingId: string;
}
