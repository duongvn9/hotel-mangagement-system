export const ROOM_LABELS = {
  AVAILABLE: 'Sẵn sàng',
  OCCUPIED: 'Đang ở',
  CLEANING: 'Đang dọn',
  MAINTENANCE: 'Bảo trì',
}
export const TASK_LABELS = {
  ASSIGNED: 'Đã giao',
  IN_PROGRESS: 'Đang xử lý',
  COMPLETED: 'Hoàn thành',
}
export const BOOKING_LABELS = {
  ROOM_HELD: 'Đang giữ phòng',
  PENDING_DEPOSIT: 'Chờ cọc',
  CONFIRMED: 'Đã xác nhận',
  CHECKED_IN: 'Đã nhận phòng',
  CHECKED_OUT: 'Đã trả phòng',
  CANCELLED: 'Đã hủy',
  EXPIRED: 'Hết hạn giữ phòng',
}
export const ISSUE_LABELS = {
  PENDING_REVIEW: 'Chờ xem xét',
  REVIEWED: 'Đã xem xét',
  ASSIGNING: 'Đang phân công',
  ASSIGNED: 'Đã giao',
  CONCLUDED: 'Đã kết luận',
  CLOSED: 'Đã đóng',
}
export const REVIEW_LABELS = {
  PENDING_REVIEW: 'Chờ xem xét',
  ACCEPTING: 'Đang tiếp nhận',
  ACCEPTED: 'Đã tiếp nhận',
  REJECTED: 'Đã từ chối',
}
export const EXECUTION_LABELS = {
  NOT_STARTED: 'Chưa bắt đầu',
  ASSIGNING: 'Đang phân công',
  ...TASK_LABELS,
}
export const SOURCE_LABELS = {
  SERVICE_ORDER: 'Yêu cầu dịch vụ',
  ISSUE: 'Sự cố',
  MAINTENANCE: 'Bảo trì',
}
export const METRICS = {
  bookingsCreated: 'Đặt phòng mới',
  checkIns: 'Nhận phòng',
  serviceOrdersCreated: 'Yêu cầu dịch vụ mới',
  issuesReported: 'Sự cố được báo',
  maintenanceReported: 'Bảo trì được báo',
  tasksCompleted: 'Task hoàn thành',
}
export const operationalPercent = (rate: number | null) =>
  rate === null
    ? 'Không xác định'
    : new Intl.NumberFormat('vi-VN', {
        style: 'percent',
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }).format(rate)
