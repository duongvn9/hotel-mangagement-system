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
 * Nguồn giá authoritative cho H7, lấy từ RoomType.basePrice của từng phòng đã đặt.
 *
 * rate = RoomType.basePrice; units = số đêm theo ngày nghiệp vụ Việt Nam
 * (businessBoundary(checkOut) - businessBoundary(checkIn)). Phòng thiếu RoomType bị bỏ
 * khỏi kết qua; InvoicesService sẽ fail-closed vì pricing không phủ đủ số phòng đã đặt.
 * Không suy đoán giá từ client totals.
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
      return [
        { roomId: String(row._id), rate: row.roomType.basePrice, units },
      ];
    });
  }
}
