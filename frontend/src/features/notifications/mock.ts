/**
 * Dữ liệu mẫu cho màn Thông báo (prototype đánh dấu "Đề xuất UX", chưa có backend).
 * Thay bằng API khi backend có; không dùng cho logic nghiệp vụ.
 */
export interface MockNotification {
  id: string
  title: string
  body: string
  /** Ngày hiển thị, YYYY-MM-DD. */
  date: string
  read: boolean
  roles: string[]
}

export const MOCK_NOTIFICATIONS: MockNotification[] = [
  {
    id: 'n1',
    title: 'Đặt phòng trực tuyến mới',
    body: 'BK2408 · Deluxe Giường King · 3 đêm',
    date: '2026-11-06',
    read: false,
    roles: ['RECEPTIONIST', 'MANAGER'],
  },
  {
    id: 'n2',
    title: 'Sự cố ưu tiên cao',
    body: 'Điều hoà phòng 202 rò nước',
    date: '2026-11-05',
    read: false,
    roles: ['OPERATIONS_STAFF', 'MANAGER'],
  },
  {
    id: 'n3',
    title: 'Có yêu cầu dịch vụ mới',
    body: 'Bữa sáng tại phòng 203',
    date: '2026-11-06',
    read: false,
    roles: ['SERVICE_STAFF'],
  },
  {
    id: 'n4',
    title: 'Đã xác nhận đặt cọc',
    body: 'Đặt phòng BK2401 của bạn đã được xác nhận.',
    date: '2026-11-04',
    read: true,
    roles: ['CUSTOMER'],
  },
  {
    id: 'n5',
    title: 'Thanh toán chưa đối soát',
    body: '6 giao dịch VNPay đang chờ kiểm tra',
    date: '2026-11-05',
    read: false,
    roles: ['RECEPTIONIST', 'MANAGER'],
  },
]

export const notificationsFor = (role: string): MockNotification[] =>
  MOCK_NOTIFICATIONS.filter((notification) => notification.roles.includes(role))
