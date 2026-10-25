import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { RoomStatus } from '../../common/constants/room-status.enum.js';
import { Room } from '../rooms/schemas/room.schema.js';
import { AvailabilityRoomSource } from './availability.adapters.js';
import type {
  AvailabilityQuery,
  AvailabilityRoom,
  StayInterval,
} from './availability.core.js';

type PopulatedRoomType = {
  _id: Types.ObjectId;
  name: string;
  basePrice: number;
  adultCapacity: number;
  childCapacity: number;
  isActive: boolean;
} | null;

/**
 * Nguồn phòng thật cho H6, đọc model Room (H3 của Lâm) và populate RoomType.
 *
 * Ánh xạ do Hiếu quyết định (RoomType nay tách adultCapacity/childCapacity):
 * - capacity = adultCapacity + childCapacity (tổng sức chứa so với `guests`).
 * - operationallyAvailable = status !== MAINTENANCE: phòng MAINTENANCE không phục vụ
 *   đặt mới; OCCUPIED/CLEANING là trạng thái tức thời, việc chặn theo ngày do overlap
 *   reservation/hold xử lý riêng trong availability.core.
 * - Phòng thiếu RoomType (tham chiếu hỏng) bị loại khỏi candidate một cách bảo thủ.
 */
@Injectable()
export class MongoAvailabilityRoomSource extends AvailabilityRoomSource {
  constructor(@InjectModel(Room.name) private readonly rooms: Model<Room>) {
    super();
  }

  async findCandidates(
    query: AvailabilityQuery & StayInterval,
  ): Promise<readonly AvailabilityRoom[]> {
    const filter: Record<string, unknown> = { isActive: true };
    if (query.roomTypeId) {
      filter.roomType = new Types.ObjectId(query.roomTypeId);
    }
    const rows = await this.rooms
      .find(filter)
      .select('roomType status isActive')
      .populate<{ roomType: PopulatedRoomType }>(
        'roomType',
        'name basePrice adultCapacity childCapacity isActive',
      )
      .lean()
      .exec();

    return rows.flatMap((row) => {
      const roomType = row.roomType;
      if (!roomType) return [];
      return [
        {
          id: String(row._id),
          roomTypeId: String(roomType._id),
          roomTypeName: roomType.name,
          pricePerNight: roomType.basePrice,
          capacity: roomType.adultCapacity + roomType.childCapacity,
          isActive: row.isActive,
          roomTypeActive: roomType.isActive,
          operationallyAvailable: row.status !== RoomStatus.Maintenance,
        },
      ];
    });
  }
}
