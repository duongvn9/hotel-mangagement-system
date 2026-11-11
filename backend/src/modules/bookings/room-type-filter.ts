import { Types } from 'mongoose';

/**
 * Bộ lọc loại phòng dùng chung cho tìm phòng (UC05) và danh sách công khai.
 * Tất cả tiêu chí đều AND: loại phòng phải thoả mọi tiêu chí được chọn.
 */
export interface RoomTypeFilterParams {
  /** Loại phòng phải CHỨA tất cả loại giường này (AND). */
  bedTypeIds?: string[];
  /** Loại phòng phải CÓ tất cả tiện nghi này (AND). */
  amenityIds?: string[];
  /** Đơn giá mỗi đêm tối thiểu (VND). */
  priceMin?: number;
  /** Đơn giá mỗi đêm tối đa (VND). */
  priceMax?: number;
  /** Sức chứa người lớn tối thiểu. */
  adults?: number;
  /** Sức chứa trẻ em tối thiểu. */
  children?: number;
}

export function hasRoomTypeFilter(params: RoomTypeFilterParams): boolean {
  return Boolean(
    params.bedTypeIds?.length ||
    params.amenityIds?.length ||
    params.priceMin !== undefined ||
    params.priceMax !== undefined ||
    params.adults !== undefined ||
    params.children !== undefined,
  );
}

/** Dựng điều kiện Mongo trên RoomType từ bộ lọc (không gồm isActive). */
export function roomTypeFilter(
  params: RoomTypeFilterParams,
): Record<string, unknown> {
  const filter: Record<string, unknown> = {};
  if (params.bedTypeIds?.length)
    filter['beds.bedType'] = {
      $all: params.bedTypeIds.map((id) => new Types.ObjectId(id)),
    };
  if (params.amenityIds?.length)
    filter.amenities = {
      $all: params.amenityIds.map((id) => new Types.ObjectId(id)),
    };
  if (params.priceMin !== undefined || params.priceMax !== undefined)
    filter.basePrice = {
      ...(params.priceMin !== undefined ? { $gte: params.priceMin } : {}),
      ...(params.priceMax !== undefined ? { $lte: params.priceMax } : {}),
    };
  if (params.adults !== undefined)
    filter.adultCapacity = { $gte: params.adults };
  if (params.children !== undefined)
    filter.childCapacity = { $gte: params.children };
  return filter;
}
