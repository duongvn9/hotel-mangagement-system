import { format } from 'date-fns'
import { vi } from 'date-fns/locale'

export const vnd = (n: number) => new Intl.NumberFormat('vi-VN').format(Math.round(n)) + ' ₫'
export const fdate = (d: string) => format(new Date(d), "dd 'thg' M, yyyy", { locale: vi })
export const fshort = (d: string) => format(new Date(d), 'dd/MM', { locale: vi })

const vn: Record<string, string> = {
  ROOM_HELD: 'Đang giữ phòng',
  PENDING_DEPOSIT: 'Chờ đặt cọc',
  CONFIRMED: 'Đã xác nhận',
  CHECKED_IN: 'Đã nhận phòng',
  CHECKED_OUT: 'Đã trả phòng',
  CANCELLED: 'Đã huỷ',
  EXPIRED: 'Hết hạn',
  ABANDONED: 'Đã dừng kỹ thuật · lịch dịch vụ đã qua',
  AVAILABLE: 'Trống',
  OCCUPIED: 'Có khách',
  CLEANING: 'Đang dọn',
  MAINTENANCE: 'Bảo trì',
  SUCCESS: 'Thành công',
  PENDING: 'Đang chờ',
  FAILED: 'Thất bại',
  IN_PROGRESS: 'Đang xử lý',
  DONE: 'Hoàn thành',
  OPEN: 'Cần làm',
  REPORTED: 'Đã báo cáo',
  RESOLVED: 'Đã xử lý',
  GOOD: 'Tốt',
  NEEDS_REPAIR: 'Cần sửa',
  BROKEN: 'Hỏng',
  HIGH: 'Cao',
  MEDIUM: 'Trung bình',
  LOW: 'Thấp',
  ACTIVE: 'Hoạt động',
  INACTIVE: 'Ngừng hoạt động',
  WALK_IN: 'Khách vãng lai',
  ONLINE: 'Trực tuyến',
  VNPAY: 'VNPay',
  CASH: 'Tiền mặt',
  CARD: 'Thẻ',
  SERVICE: 'Dịch vụ',
  CUSTOMER: 'Khách hàng',
  RECEPTIONIST: 'Lễ tân',
  SERVICE_STAFF: 'Nhân viên dịch vụ',
  OPERATIONS_STAFF: 'Nhân viên vận hành',
  MANAGER: 'Quản lý',
  true: 'Đã đối soát',
  false: 'Chưa đối soát',
  Essentials: 'Thiết yếu',
  Comfort: 'Tiện nghi',
  Premium: 'Cao cấp',
}
export const label = (s: string) =>
  vn[s] ??
  s
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase())
