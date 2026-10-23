import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ListRoomTypesQuery } from './dto/list-room-types.dto.js';
import type { RoomTypeListResponse } from './dto/room-type-response.dto.js';
import { RoomType, validBasePrice } from './schemas/room-type.schema.js';

@Injectable()
export class RoomTypesService {
  constructor(
    @InjectModel(RoomType.name) private readonly roomTypes: Model<RoomType>,
  ) {}

  async list(query: ListRoomTypesQuery): Promise<RoomTypeListResponse> {
    const { page, limit, sortBy, sortOrder } = query;
    const filter = {
      ...(query.search
        ? {
            name: {
              $regex: query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
              $options: 'i',
            },
          }
        : {}),
      ...(query.isActive === undefined ? {} : { isActive: query.isActive }),
    };
    const [rows, total] = await Promise.all([
      this.roomTypes
        .find(filter)
        .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1, _id: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate<{ amenities: { _id: Types.ObjectId; name: string }[] }>(
          'amenities',
          'name',
        )
        .lean()
        .exec(),
      this.roomTypes.countDocuments(filter).exec(),
    ]);
    return {
      items: rows.map((row) => ({
        id: String(row._id),
        name: row.name,
        description: row.description ?? '',
        capacity: row.capacity,
        basePrice: row.basePrice,
        amenities: (row.amenities ?? [])
          .filter(Boolean)
          .map((amenity) => ({ id: String(amenity._id), name: amenity.name })),
        isActive: row.isActive,
        availableForBooking:
          row.isActive === true &&
          Number.isSafeInteger(row.capacity) &&
          row.capacity >= 1 &&
          validBasePrice(row.basePrice),
      })),
      total,
      page,
      limit,
    };
  }
}
