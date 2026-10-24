import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Role } from '../constants/role.enum.js';
import type { AuthUser } from './auth-user.js';

/** Nhân viên được phép thao tác trên booking của khách. */
const STAFF_ROLES: readonly string[] = [Role.Receptionist, Role.Manager];

export interface BookingActor {
  /** Người dùng đã đăng nhập (nếu có). */
  user?: AuthUser;
  /** Mã booking Guest cung cấp làm "vé" truy cập khi không đăng nhập. */
  code?: string;
}

export interface AccessibleBooking {
  customer?: unknown;
  code: string;
}

/**
 * Quy tắc truy cập một booking đã tồn tại (thanh toán, huỷ...):
 * - Customer đăng nhập: chỉ booking của chính mình.
 * - Lễ tân/Quản lý: mọi booking (thao tác tại quầy).
 * - Guest (không đăng nhập): chỉ booking không gắn customer và phải đúng mã booking.
 */
export function authorizeBookingAccess(
  booking: AccessibleBooking,
  actor: BookingActor,
): void {
  const user = actor.user;
  if (user) {
    if (user.role === Role.Customer) {
      if (!booking.customer || String(booking.customer) !== user.id) {
        throw new ForbiddenException('Not your booking');
      }
      return;
    }
    if (STAFF_ROLES.includes(user.role)) return;
    throw new ForbiddenException('This role cannot act on bookings');
  }
  if (!actor.code || booking.customer) {
    throw new UnauthorizedException(
      'Login or a matching booking code is required',
    );
  }
  if (actor.code !== booking.code) {
    throw new ForbiddenException('Booking code does not match');
  }
}
