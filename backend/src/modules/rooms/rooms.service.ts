import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Room } from './schemas/room.schema.js';
import { ListRoomsQuery } from './dto/list-rooms.dto.js';
import type { RoomListResponse } from './dto/room-response.dto.js';

@Injectable()
export class RoomsService {
  private readonly logger = new Logger(RoomsService.name);
  constructor(@InjectModel(Room.name) private readonly rooms: Model<Room>) {}

  async list(query: ListRoomsQuery): Promise<RoomListResponse> {
    const filter = {
      ...(query.search
        ? {
            roomNumber: {
              $regex: query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
              $options: 'i',
            },
          }
        : {}),
      ...(query.roomTypeId
        ? { roomType: new Types.ObjectId(query.roomTypeId) }
        : {}),
      ...(query.status === undefined ? {} : { status: query.status }),
      ...(query.isActive === undefined ? {} : { isActive: query.isActive }),
      ...(query.floor === undefined ? {} : { floor: query.floor }),
    };
    const collation = { locale: 'en', numericOrdering: true };
    const [rows, total] = await Promise.all([
      this.rooms
        .find(filter)
        .collation(collation)
        .sort({ [query.sortBy]: query.sortOrder === 'desc' ? -1 : 1, _id: 1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .populate<{
          roomType: {
            _id: Types.ObjectId;
            name: string;
            isActive: boolean;
          } | null;
        }>('roomType', 'name isActive')
        .lean()
        .exec(),
      this.rooms.countDocuments(filter).collation(collation).exec(),
    ]);
    return {
      items: rows.map((row) => {
        if (!row.roomType)
          this.logger.warn(`Room ${row._id} has a missing RoomType reference`);
        return {
          id: String(row._id),
          roomNumber: row.roomNumber,
          floor: row.floor,
          roomType: row.roomType
            ? {
                id: String(row.roomType._id),
                name: row.roomType.name,
                isActive: row.roomType.isActive,
              }
            : null,
          status: row.status,
          notes: row.notes ?? '',
          isActive: row.isActive,
        };
      }),
      total,
      page: query.page,
      limit: query.limit,
    };
  }
}
