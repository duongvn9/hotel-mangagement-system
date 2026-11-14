import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BookingStatus } from '../../common/constants/booking-status.enum.js';
import { Role } from '../../common/constants/role.enum.js';
import { Booking } from '../bookings/schemas/booking.schema.js';
import { User } from '../users/schemas/user.schema.js';
import type {
  GuestListResponse,
  GuestProfile,
  ListGuestsQuery,
} from './dto/list-guests.dto.js';

const escapeRegex = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Thống kê booking gộp theo email (viết thường). */
interface BookingStats {
  _id: string;
  name: string;
  email: string;
  phone: string;
  lastBookedAt: Date;
  totalBookings: number;
  completedStays: number;
  lastCheckIn: Date | null;
}

interface MergedGuest extends GuestProfile {
  /** Dùng để sắp xếp; không trả về client. */
  lastBookedAt: Date | null;
}

@Injectable()
export class GuestsService {
  constructor(
    @InjectModel(Booking.name) private readonly bookings: Model<Booking>,
    @InjectModel(User.name) private readonly users: Model<User>,
  ) {}

  /**
   * UC14: tìm khách để lễ tân tạo booking. Gộp hai nguồn theo email (viết thường) nên mỗi người
   * chỉ hiện một dòng dù vừa có tài khoản vừa từng đặt với tư cách khách vãng lai:
   *  1) tài khoản khách hàng (role Customer đang hoạt động) khớp từ khoá — kể cả khách chưa từng đặt;
   *  2) khách suy ra từ booking (khách vãng lai/Guest không có tài khoản chỉ tồn tại trong booking).
   * `hasAccount` dựa trên việc email có tài khoản đăng ký hay không. Tìm theo mã booking vẫn ra số
   * liệu đúng vì thống kê tính trên toàn bộ booking của email đó. Quét collection, hợp quy mô hiện tại.
   */
  async search({
    q,
    page,
    limit,
  }: ListGuestsQuery): Promise<GuestListResponse> {
    const pattern = { $regex: escapeRegex(q), $options: 'i' };

    // 1) Email của các booking khớp từ khoá.
    const matched = await this.bookings.aggregate<{ _id: string | null }>([
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
    const bookingEmails = matched
      .map((row) => row._id)
      .filter((email): email is string => Boolean(email));

    // 2) Tài khoản khách hàng khớp từ khoá, kèm tài khoản của những email booking ở trên
    //    (để biết email nào có tài khoản và lấy tên/SĐT chuẩn khi khách chưa từng đặt).
    const accounts = await this.users
      .find({
        role: Role.Customer,
        isActive: true,
        $or: [
          { fullName: pattern },
          { email: pattern },
          { phone: pattern },
          ...(bookingEmails.length > 0
            ? [{ email: { $in: bookingEmails } }]
            : []),
        ],
      })
      .select('email fullName phone')
      .lean();
    const accountByEmail = new Map(
      accounts.map((account) => [account.email.toLowerCase(), account]),
    );

    // 3) Mọi email liên quan (gộp, viết thường).
    const emails = [...new Set([...bookingEmails, ...accountByEmail.keys()])];
    if (emails.length === 0) return { items: [], total: 0, page, limit };

    // 4) Thống kê booking cho tất cả email liên quan (kể cả booking không khớp từ khoá).
    const stats = await this.bookings.aggregate<BookingStats>([
      {
        $match: {
          isActive: true,
          $expr: { $in: [{ $toLower: '$guestEmail' }, emails] },
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
    ]);
    const statsByEmail = new Map(stats.map((row) => [row._id, row]));

    // 5) Gộp theo email: ưu tiên tên/SĐT/email từ tài khoản, chỉ lấy từ booking khi không có tài khoản.
    const merged: MergedGuest[] = emails.map((email) => {
      const stat = statsByEmail.get(email);
      const account = accountByEmail.get(email);
      return {
        name: account?.fullName ?? stat?.name ?? '',
        email: stat?.email ?? account?.email ?? email,
        phone: account?.phone ?? stat?.phone ?? '',
        hasAccount: Boolean(account),
        totalBookings: stat?.totalBookings ?? 0,
        completedStays: stat?.completedStays ?? 0,
        lastCheckIn: stat?.lastCheckIn ? stat.lastCheckIn.toISOString() : null,
        lastBookedAt: stat?.lastBookedAt ?? null,
      };
    });

    // 6) Khách có booking (mới nhất trước), rồi tới khách chỉ có tài khoản (theo tên).
    merged.sort((a, b) => {
      const at = a.lastBookedAt ? a.lastBookedAt.getTime() : -Infinity;
      const bt = b.lastBookedAt ? b.lastBookedAt.getTime() : -Infinity;
      if (at !== bt) return bt - at;
      return a.name.localeCompare(b.name, 'vi');
    });

    const start = (page - 1) * limit;
    const items: GuestProfile[] = merged
      .slice(start, start + limit)
      .map(({ lastBookedAt: _lastBookedAt, ...profile }) => profile);

    return { items, total: merged.length, page, limit };
  }
}
