import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { Model, Types } from 'mongoose';
import { Booking } from './schemas/booking.schema.js';

const ownership = new AsyncLocalStorage<{ bookingId: string; token: string }>();

export async function withBookingFinancialOperation<T>(
  bookings: Model<Booking>,
  bookingId: string,
  operation: () => Promise<T>,
): Promise<T> {
  if (!/^[a-f\d]{24}$/i.test(bookingId))
    throw new BadRequestException('Đường dẫn đơn đặt phòng không hợp lệ.');
  bookingId = new Types.ObjectId(bookingId).toHexString();
  const current = ownership.getStore();
  if (current?.bookingId === bookingId) {
    const owned = await bookings.exists({
      _id: new Types.ObjectId(bookingId),
      financialOperationToken: current.token,
    });
    if (!owned)
      throw new ConflictException(
        'Thao tác thanh toán bị gián đoạn. Vui lòng thử lại.',
      );
    return operation();
  }
  const token = randomUUID();
  let acquired = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    const result = await bookings.updateOne(
      {
        _id: new Types.ObjectId(bookingId),
        isActive: true,
        financialOperationToken: { $exists: false },
      },
      {
        $set: {
          financialOperationToken: token,
          financialOperationStartedAt: new Date(),
        },
      },
    );
    if (result.modifiedCount === 1) {
      acquired = true;
      break;
    }
    if (
      !(await bookings.exists({
        _id: new Types.ObjectId(bookingId),
        isActive: true,
      }))
    )
      throw new NotFoundException('Không tìm thấy đơn đặt phòng.');
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  if (!acquired)
    throw new ConflictException(
      'Đang có một thao tác thanh toán khác diễn ra. Vui lòng thử lại.',
    );
  try {
    return await ownership.run({ bookingId, token }, operation);
  } finally {
    await bookings.updateOne(
      { _id: new Types.ObjectId(bookingId), financialOperationToken: token },
      {
        $unset: { financialOperationToken: 1, financialOperationStartedAt: 1 },
      },
    );
  }
}
