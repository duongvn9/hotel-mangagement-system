import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BookingStatus } from '../../common/constants/booking-status.enum.js';
import { Booking } from '../bookings/schemas/booking.schema.js';
import type {
  GuestListResponse,
  ListGuestsQuery,
} from './dto/list-guests.dto.js';

const escapeRegex = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

interface GuestGroup {
  name: string;
  email: string;
  phone: string;
  hasAccount: boolean;
  totalBookings: number;
  completedStays: number;
  lastCheckIn: Date | null;
}

@Injectable()
export class GuestsService {
  constructor(
    @InjectModel(Booking.name) private readonly bookings: Model<Booking>,
  ) {}

  /**
   * UC14: hồ sơ khách gộp từ booking (khách walk-in và Guest không có tài khoản chỉ tồn tại
   * dưới dạng thông tin liên hệ trong booking). Nhận diện khách theo email viết thường.
   * Bước 1 tìm các email có booking khớp từ khoá; bước 2 tính thống kê trên toàn bộ booking
   * của các email đó nên tìm theo mã booking vẫn ra số liệu đúng. Cả hai bước quét collection,
   * phù hợp quy mô hiện tại.
   */
  async search({
    q,
    page,
    limit,
  }: ListGuestsQuery): Promise<GuestListResponse> {
    const pattern = { $regex: escapeRegex(q), $options: 'i' };
    const matched = await this.bookings.aggregate<{ _id: string }>([
      {
        $match: {
          isActive: true,
          $or: [
            { code: pattern },
            { guestName: pattern },
            { guestEmail: pattern },
            { guestPhone: pattern },
          ],
        },
      },
      { $group: { _id: { $toLower: '$guestEmail' } } },
    ]);
    if (matched.length === 0) return { items: [], total: 0, page, limit };

    const [result] = await this.bookings.aggregate<{
      items: (GuestGroup & { _id: string })[];
      total: { count: number }[];
    }>([
      {
        $match: {
          isActive: true,
          $expr: {
            $in: [{ $toLower: '$guestEmail' }, matched.map((row) => row._id)],
          },
        },
      },
      { $sort: { createdAt: -1, _id: -1 } },
      {
        $group: {
          _id: { $toLower: '$guestEmail' },
          name: { $first: '$guestName' },
          email: { $first: '$guestEmail' },
          phone: { $first: '$guestPhone' },
          lastBookedAt: { $first: '$createdAt' },
          hasAccount: {
            $max: {
              $cond: [{ $eq: [{ $type: '$customer' }, 'objectId'] }, 1, 0],
            },
          },
          totalBookings: { $sum: 1 },
          completedStays: {
            $sum: {
              $cond: [{ $eq: ['$status', BookingStatus.CheckedOut] }, 1, 0],
            },
          },
          lastCheckIn: {
            $max: {
              $cond: [
                { $ne: ['$status', BookingStatus.Cancelled] },
                '$checkIn',
                null,
              ],
            },
          },
        },
      },
      { $sort: { lastBookedAt: -1, _id: 1 } },
      {
        $facet: {
          items: [{ $skip: (page - 1) * limit }, { $limit: limit }],
          total: [{ $count: 'count' }],
        },
      },
    ]);

    return {
      items: (result?.items ?? []).map((group) => ({
        name: group.name,
        email: group.email,
        phone: group.phone,
        hasAccount: Boolean(group.hasAccount),
        totalBookings: group.totalBookings,
        completedStays: group.completedStays,
        lastCheckIn: group.lastCheckIn ? group.lastCheckIn.toISOString() : null,
      })),
      total: result?.total[0]?.count ?? 0,
      page,
      limit,
    };
  }
}
