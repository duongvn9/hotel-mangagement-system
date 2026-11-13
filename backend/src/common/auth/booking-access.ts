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
        throw new ForbiddenException('Đơn này không thuộc tài khoản của bạn.');
      }
      return;
    }
    if (STAFF_ROLES.includes(user.role)) return;
    throw new ForbiddenException(
      'Tài khoản này không có quyền thao tác với đơn đặt phòng.',
    );
  }
  // Đơn gắn với tài khoản đã đăng ký thì chỉ chủ tài khoản (đăng nhập) mới xem được,
  // không mở bằng mã booking được — kể cả khi khách nhập đúng mã.
  if (booking.customer) {
    throw new UnauthorizedException(
      'Đơn này được đặt bằng một tài khoản đã đăng ký. Vui lòng đăng nhập bằng tài khoản đó để xem đơn.',
    );
  }
  if (!actor.code) {
    throw new UnauthorizedException(
      'Vui lòng đăng nhập, hoặc nhập mã booking (vé) đã nhận qua email để xem đơn.',
    );
  }
  if (actor.code !== booking.code) {
    throw new ForbiddenException(
      'Mã booking không đúng. Vui lòng kiểm tra lại mã trong email xác nhận.',
    );
  }
}
