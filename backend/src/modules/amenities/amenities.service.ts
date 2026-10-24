import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Amenity } from './schemas/amenity.schema.js';
import { RoomType } from '../room-types/schemas/room-type.schema.js';
import { ListAmenitiesQuery } from './dto/list-amenities.dto.js';
import type {
  AmenityListResponse,
  AmenityRoomTypeResponse,
} from './dto/amenity-response.dto.js';

@Injectable()
export class AmenitiesService {
  constructor(
    @InjectModel(Amenity.name) private readonly amenities: Model<Amenity>,
    @InjectModel(RoomType.name) private readonly roomTypes: Model<RoomType>,
  ) {}

  async list(query: ListAmenitiesQuery): Promise<AmenityListResponse> {
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
      this.amenities
        .find(filter)
        .sort({ [query.sortBy]: query.sortOrder === 'desc' ? -1 : 1, _id: 1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .lean()
        .exec(),
      this.amenities.countDocuments(filter).exec(),
    ]);
    const groups = new Map<string, AmenityRoomTypeResponse[]>(
      rows.map((row) => [String(row._id), []]),
    );
    if (rows.length) {
      const types = await this.roomTypes
        .find({ amenities: { $in: rows.map((row) => row._id) } })
        .select('name isActive amenities')
        .sort({ name: 1, _id: 1 })
        .lean()
        .exec();
      for (const type of types) {
        for (const id of new Set((type.amenities ?? []).map(String))) {
          groups.get(id)?.push({
            id: String(type._id),
            name: type.name,
            isActive: type.isActive,
          });
        }
      }
    }
    return {
      items: rows.map((row) => {
        const roomTypes = groups.get(String(row._id))!;
        return {
          id: String(row._id),
          name: row.name,
          description: row.description ?? '',
          isActive: row.isActive,
          roomTypes,
          roomTypeCount: roomTypes.length,
        };
      }),
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  async options() {
    const rows = await this.amenities
      .find({ isActive: true })
      .sort({ name: 1, _id: 1 })
      .lean()
      .exec();
    return rows.map((row) => ({ id: String(row._id), name: row.name }));
  }

  async validateNew(ids: string[], retained: string[] = []) {
    const added = ids.filter((id) => !retained.includes(id));
    if (!added.length) return;
    const rows = await this.amenities
      .find({ _id: { $in: added }, isActive: true })
      .select('_id')
      .lean()
      .exec();
    const found = new Set(rows.map((row) => String(row._id)));
    const invalid = added.filter((id) => !found.has(id));
    if (invalid.length)
      throw new BadRequestException(
        `amenities không hợp lệ: ${invalid.join(', ')}`,
      );
  }
}
