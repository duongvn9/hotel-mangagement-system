import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { businessBoundary } from '../bookings/availability.core.js';
import type { BookingDocument } from '../bookings/schemas/booking.schema.js';
import { Room } from '../rooms/schemas/room.schema.js';
import {
  InvoicePricingAdapter,
  type RoomPricingLine,
} from './invoice-adapters.js';

const MS_PER_DAY = 86_400_000;

/**
 * Nguồn giá authoritative cho H7.
 *
 * units = số đêm theo ngày nghiệp vụ Việt Nam. rate ưu tiên lấy từ `rateSnapshot` chốt
 * lúc đặt phòng (để H7 tính lại kiểm chứng, không lệ thuộc giá RoomType đổi sau); nếu
 * booking chưa có snapshot (dữ liệu cũ/seed) thì fallback về RoomType.basePrice hiện tại.
 * Phòng thiếu giá bị bỏ khỏi kết quả; InvoicesService fail-closed vì pricing không phủ đủ.
 */
@Injectable()
export class RoomTypePricingAdapter extends InvoicePricingAdapter {
  constructor(@InjectModel(Room.name) private readonly rooms: Model<Room>) {
    super();
  }

  async getRoomLines(
    booking: BookingDocument,
  ): Promise<readonly RoomPricingLine[]> {
    const units = Math.round(
      (businessBoundary(booking.checkOut).getTime() -
        businessBoundary(booking.checkIn).getTime()) /
        MS_PER_DAY,
    );

    const snapshot = new Map(
      (booking.rateSnapshot ?? []).map((entry) => [
        String(entry.room),
        entry.ratePerNight,
      ]),
    );
    if (booking.rooms.every((room) => snapshot.has(String(room)))) {
      return booking.rooms.map((room) => ({
        roomId: String(room),
        rate: snapshot.get(String(room))!,
        units,
      }));
    }

    const rows = await this.rooms
      .find({ _id: { $in: booking.rooms } })
      .populate<{ roomType: { basePrice: number } | null }>(
        'roomType',
        'basePrice',
      )
      .lean()
      .exec();

    return rows.flatMap((row) => {
      if (!row.roomType) return [];
      return [{ roomId: String(row._id), rate: row.roomType.basePrice, units }];
    });
  }
}
