import type { BookingChargesResponse } from './checkout-charge.dto.js';

export class CheckOutRoom {
  id: string;
  roomNumber: string;
  /** Trạng thái phòng sau check-out: CLEANING, hoặc giữ nguyên nếu phòng không còn OCCUPIED. */
  status: string;
}

export class CheckOutResult {
  id: string;
  code: string;
  status: string;
  checkedOutAt: string;
  rooms: CheckOutRoom[];
  /** Hóa đơn cuối đã thanh toán đủ. */
  invoice: BookingChargesResponse;
}
