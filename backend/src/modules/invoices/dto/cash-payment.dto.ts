import { ApiProperty } from '@nestjs/swagger';
import { Matches } from 'class-validator';

/** Số tiền không nhận từ client: server lấy đúng số còn phải trả của hóa đơn. */
export class RecordCashPaymentDto {
  @ApiProperty({
    description:
      'Mã do giao diện sinh cho mỗi lần xác nhận thu tiền; gửi lại cùng mã không ghi thêm khoản thu',
  })
  @Matches(/^[A-Za-z0-9_-]{8,64}$/, {
    message: 'requestId must be 8-64 characters of letters, digits, _ or -',
  })
  requestId: string;
}
