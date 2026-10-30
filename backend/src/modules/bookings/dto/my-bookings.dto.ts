import { ApiProperty } from '@nestjs/swagger';

/** Một dòng booking trong "Đặt phòng của tôi" (Customer đăng nhập). */
export class MyBookingItem {
  @ApiProperty()
  id: string;

  @ApiProperty()
  code: string;

  @ApiProperty()
  status: string;

  @ApiProperty()
  checkIn: string;

  @ApiProperty()
  checkOut: string;

  @ApiProperty()
  adultCount: number;

  @ApiProperty()
  childCount: number;

  @ApiProperty({ description: 'Số phòng của booking' })
  roomCount: number;

  @ApiProperty({ description: 'Tiền phòng (VND)' })
  roomTotal: number;

  @ApiProperty({ description: 'Tiền cọc (VND)' })
  depositAmount: number;

  @ApiProperty({ description: 'Thời điểm tạo booking (ISO)' })
  createdAt: string;
}
