import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { ChargeCategory } from '../schemas/invoice-charge.schema.js';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsMongoId,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/** Mức phụ phí tối đa một khoản (VND), chặn nhập nhầm số quá lớn. */
export const MAX_CHECKOUT_CHARGE = 100_000_000;

export class AddCheckoutChargeDto {
  @ApiProperty({
    minimum: 1,
    maximum: MAX_CHECKOUT_CHARGE,
    description: 'Số tiền phụ phí (VND, số nguyên dương)',
  })
  @IsInt()
  @Min(1)
  @Max(MAX_CHECKOUT_CHARGE)
  amount: number;

  @ApiProperty({ maxLength: 200, description: 'Lý do thu phụ phí' })
  @Transform(trim)
  @IsString()
  @Length(1, 200)
  reason: string;

  @ApiPropertyOptional({
    enum: ChargeCategory,
    description: 'Phân loại phụ phí: hư hỏng, trả phòng muộn hoặc khác',
  })
  @IsOptional()
  @IsEnum(ChargeCategory)
  category?: ChargeCategory;

  @ApiProperty({
    description:
      'Mã do giao diện sinh cho mỗi lần lưu; gửi lại cùng mã (retry, bấm hai lần) không ghi thêm khoản mới',
  })
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{8,64}$/, {
    message: 'requestId must be 8-64 characters of letters, digits, _ or -',
  })
  requestId: string;
}

/** Số lượng tối đa một lần thêm dịch vụ cho khách đang ở. */
export const MAX_SERVICE_QUANTITY = 99;

export class AddCheckoutServiceDto {
  @ApiProperty({
    description: 'Id dịch vụ trong danh mục (đang hoạt động, có giá)',
  })
  @IsMongoId()
  serviceId: string;

  @ApiProperty({ minimum: 1, maximum: MAX_SERVICE_QUANTITY })
  @IsInt()
  @Min(1)
  @Max(MAX_SERVICE_QUANTITY)
  quantity: number;

  @ApiProperty({
    description:
      'Mã do giao diện sinh cho mỗi lần lưu; gửi lại cùng mã không ghi thêm khoản mới',
  })
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{8,64}$/, {
    message: 'requestId must be 8-64 characters of letters, digits, _ or -',
  })
  requestId: string;
}

export class ChargeLine {
  type: string;
  category?: string;
  amount: number;
  reason: string;
  sourceId?: string;
  serviceName?: string;
  quantity?: number;
  unitPriceVND?: number;
}

export class InvoiceTotals {
  roomTotal: number;
  serviceTotal: number;
  additionalTotal: number;
  discountTotal: number;
  taxTotal: number;
  totalAmount: number;
  depositPaid: number;
  finalPaid: number;
  balanceDue: number;
}

export class BookingChargesResponse {
  bookingId: string;
  code: string;
  status: string;
  /** Trạng thái hóa đơn: UNPAID, PARTIALLY_PAID hoặc PAID. */
  invoiceStatus: string;
  /** Thời điểm khách xác nhận các khoản phí; không có nghĩa là chưa xác nhận. */
  feesConfirmedAt?: string;
  /** Có giao dịch VNPay thanh toán cuối đang chờ; không có nghĩa là không có. */
  vnpayPending?: true;
  totals: InvoiceTotals;
  charges: ChargeLine[];
}
