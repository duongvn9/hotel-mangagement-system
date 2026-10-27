import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RoomStatus } from '../../common/constants/room-status.enum.js';
import { Booking, BookingStatus } from '../bookings/schemas/booking.schema.js';
import {
  PaymentPurpose,
  PaymentStatus,
  PaymentTransaction,
} from '../payments/schemas/payment-transaction.schema.js';
import { Room } from '../rooms/schemas/room.schema.js';
import { checkOutStatusError, unpaidBalanceMessage } from './check-out.core.js';
import type { CheckOutResult } from './dto/check-out.dto.js';
import { toBookingChargesResponse } from './invoice-summary.js';
import { InvoicesService } from './invoices.service.js';

@Injectable()
export class CheckOutService {
  constructor(
    @InjectModel(Booking.name) private readonly bookings: Model<Booking>,
    @InjectModel(Room.name) private readonly rooms: Model<Room>,
    @InjectModel(PaymentTransaction.name)
    private readonly payments: Model<PaymentTransaction>,
    private readonly invoices: InvoicesService,
  ) {}

  /**
   * UC18: lễ tân trả phòng cho khách đã thanh toán đủ hóa đơn. Booking CHECKED_IN chuyển sang
   * CHECKED_OUT (ghi checkedOutAt) và các phòng đang OCCUPIED sang CLEANING; phòng ở trạng thái
   * khác giữ nguyên. Hóa đơn được tính lại trước và sau khi đóng để không bỏ lọt khoản nợ mới.
   */
  async checkOut(bookingId: string): Promise<CheckOutResult> {
    if (!/^[a-f\d]{24}$/i.test(bookingId)) {
      throw new BadRequestException('Invalid booking ID');
    }
    const booking = await this.bookings.findById(bookingId);
    if (!booking || !booking.isActive) {
      throw new NotFoundException('Booking not found');
    }
    const statusError = checkOutStatusError(booking.status);
    if (statusError) throw new ConflictException(statusError);

    if (
      await this.payments.exists({
        booking: booking._id,
        purpose: PaymentPurpose.Final,
        status: PaymentStatus.Pending,
        isActive: true,
      })
    ) {
      throw new ConflictException(
        'A VNPay payment is still pending; wait for it to finish or fail',
      );
    }
    const before = await this.invoices.recalculate(bookingId);
    if (before.balanceDue > 0) {
      throw new ConflictException(unpaidBalanceMessage(before.balanceDue));
    }

    const now = new Date();
    const closed = await this.bookings
      .findOneAndUpdate(
        { _id: booking._id, status: BookingStatus.CheckedIn, isActive: true },
        { $set: { status: BookingStatus.CheckedOut, checkedOutAt: now } },
        { returnDocument: 'before' },
      )
      .lean()
      .exec();
    if (!closed) {
      throw new ConflictException(
        'The booking was just changed; reload it and try again',
      );
    }

    // Một khoản phí vừa lọt vào giữa hai lần tính: mở lại booking thay vì để khách ra mà còn nợ.
    const after = await this.invoices.recalculate(bookingId);
    if (after.balanceDue > 0) {
      await this.bookings.updateOne(
        { _id: booking._id },
        {
          $set: { status: BookingStatus.CheckedIn },
          $unset: { checkedOutAt: 1 },
        },
      );
      throw new ConflictException(unpaidBalanceMessage(after.balanceDue));
    }

    await this.rooms.updateMany(
      { _id: { $in: booking.rooms }, status: RoomStatus.Occupied },
      { $set: { status: RoomStatus.Cleaning } },
    );
    const roomRows = await this.rooms
      .find({ _id: { $in: booking.rooms } })
      .select('roomNumber status')
      .lean()
      .exec();
    const byId = new Map(roomRows.map((room) => [String(room._id), room]));

    return {
      id: String(booking._id),
      code: booking.code,
      status: BookingStatus.CheckedOut,
      checkedOutAt: now.toISOString(),
      rooms: booking.rooms.map((id) => ({
        id: String(id),
        roomNumber: byId.get(String(id))?.roomNumber ?? '',
        status: byId.get(String(id))?.status ?? '',
      })),
      invoice: toBookingChargesResponse(
        {
          _id: booking._id,
          code: booking.code,
          status: BookingStatus.CheckedOut,
        },
        after,
      ),
    };
  }
}
