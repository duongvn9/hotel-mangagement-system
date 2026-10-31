import { ApiProperty } from '@nestjs/swagger';

/** Một tiện nghi hiển thị công khai (chỉ id + tên). */
export class RoomTypeAmenityResponse {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;
}

/**
 * Chi tiết loại phòng công khai cho Guest xem trước khi đặt (đi kèm UC05 tìm phòng).
 * Chỉ lộ field an toàn; không trả cờ quản trị (isActive) hay _id nội bộ.
 */
export class RoomTypeOverviewResponse {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ description: 'Mô tả loại phòng' })
  description: string;

  @ApiProperty({ description: 'Số người lớn tối đa' })
  adultCapacity: number;

  @ApiProperty({ description: 'Số trẻ em tối đa' })
  childCapacity: number;

  @ApiProperty({ description: 'Sức chứa tối đa (người lớn + trẻ em)' })
  capacity: number;

  @ApiProperty({ description: 'Đơn giá mỗi đêm (VND)' })
  pricePerNight: number;

  @ApiProperty({
    type: [String],
    description: 'Ảnh loại phòng (đường dẫn storage, ảnh đầu là ảnh đại diện)',
  })
  images: string[];

  @ApiProperty({ type: [RoomTypeAmenityResponse] })
  amenities: RoomTypeAmenityResponse[];
}
