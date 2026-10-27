import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsString, Length, Matches, Max, Min } from 'class-validator';

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

export class ChargeLine {
  type: string;
  amount: number;
  reason: string;
  sourceId?: string;
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
  totals: InvoiceTotals;
  charges: ChargeLine[];
}
