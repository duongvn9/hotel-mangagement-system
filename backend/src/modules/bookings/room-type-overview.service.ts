import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { RoomType } from '../room-types/schemas/room-type.schema.js';
import type {
  RoomTypeOverviewResponse,
  RoomTypeSummaryResponse,
} from './dto/room-type-overview.dto.js';

type PopulatedAmenity = {
  _id: Types.ObjectId;
  name: string;
  isActive?: boolean;
} | null;

type PopulatedBed = {
  bedType: { _id: Types.ObjectId; name: string; isActive?: boolean } | null;
  quantity: number;
};

/** Cấu hình giường công khai: chỉ loại giường còn hoạt động, bỏ tham chiếu hỏng. */
function publicBeds(beds?: PopulatedBed[]) {
  return (beds ?? [])
    .filter(
      (
        bed,
      ): bed is PopulatedBed & {
        bedType: NonNullable<PopulatedBed['bedType']>;
      } => bed?.bedType != null && bed.bedType.isActive !== false,
    )
    .map((bed) => ({
      bedTypeId: String(bed.bedType._id),
      bedTypeName: bed.bedType.name,
      quantity: bed.quantity,
    }));
}

/**
 * Đọc công khai một loại phòng cho Guest xem trước khi đặt (đi kèm UC05).
 * Dùng lại model RoomType (H3 của Lâm) ở chế độ chỉ đọc; chỉ trả field an toàn,
 * loại phòng ngừng kinh doanh (isActive=false) coi như không tồn tại với khách.
 */
@Injectable()
export class RoomTypeOverviewService {
  constructor(
    @InjectModel(RoomType.name) private readonly roomTypes: Model<RoomType>,
  ) {}

  async findPublicById(id: string): Promise<RoomTypeOverviewResponse> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Room type not found');
    }
    const type = await this.roomTypes
      .findOne({ _id: new Types.ObjectId(id), isActive: true })
      .populate<{ amenities: PopulatedAmenity[] }>('amenities', 'name isActive')
      .populate<{ beds: PopulatedBed[] }>('beds.bedType', 'name isActive')
      .lean()
      .exec();
    if (!type) {
      throw new NotFoundException('Room type not found');
    }
    return {
      id: String(type._id),
      images: type.images ?? [],
      name: type.name,
      description: type.description ?? '',
      adultCapacity: type.adultCapacity,
      childCapacity: type.childCapacity,
      capacity: type.adultCapacity + type.childCapacity,
      pricePerNight: type.basePrice,
      // Chỉ hiển thị tiện nghi còn hiệu lực; tham chiếu hỏng (null) bị loại bỏ.
      amenities: (type.amenities ?? [])
        .filter(
          (amenity): amenity is NonNullable<PopulatedAmenity> =>
            amenity != null && amenity.isActive !== false,
        )
        .map((amenity) => ({ id: String(amenity._id), name: amenity.name })),
      beds: publicBeds(type.beds),
    };
  }

  /**
   * Mọi loại phòng đang kinh doanh để khách xem khi chưa chọn ngày (rẻ nhất trước). Chỉ field
   * an toàn của danh sách; chi tiết và tiện nghi vẫn lấy qua `findPublicById`.
   */
  async listPublic(): Promise<RoomTypeSummaryResponse[]> {
    const types = await this.roomTypes
      .find({ isActive: true })
      .sort({ basePrice: 1, name: 1, _id: 1 })
      .populate<{ beds: PopulatedBed[] }>('beds.bedType', 'name isActive')
      .lean()
      .exec();
    return types.map((type) => ({
      id: String(type._id),
      images: type.images ?? [],
      name: type.name,
      description: type.description ?? '',
      adultCapacity: type.adultCapacity,
      childCapacity: type.childCapacity,
      capacity: type.adultCapacity + type.childCapacity,
      pricePerNight: type.basePrice,
      beds: publicBeds(type.beds),
    }));
  }
}
