import { ApiProperty } from '@nestjs/swagger';
import { IsIn, Matches } from 'class-validator';

/** Cách khách trả tiền cọc tại quầy; VNPay không dùng ở đây vì khách đang đứng trước lễ tân. */
export const DESK_DEPOSIT_METHODS = ['CASH', 'CARD'] as const;
export type DeskDepositMethod = (typeof DESK_DEPOSIT_METHODS)[number];

/** Số tiền không nhận từ client: server lấy đúng tiền cọc của booking. */
export class RecordDeskDepositDto {
  @ApiProperty({ enum: DESK_DEPOSIT_METHODS })
  @IsIn(DESK_DEPOSIT_METHODS)
  method: DeskDepositMethod;

  @ApiProperty({
    description:
      'Mã do giao diện sinh cho mỗi lần thu cọc; gửi lại cùng mã không ghi thêm khoản thu',
  })
  @Matches(/^[A-Za-z0-9_-]{8,64}$/, {
    message: 'requestId must be 8-64 characters of letters, digits, _ or -',
  })
  requestId: string;
}
