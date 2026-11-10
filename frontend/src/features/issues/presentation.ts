import type { CustomerHistoryType } from './api'

export const customerHistoryLabels: Record<CustomerHistoryType, string> = {
  REPORTED: 'Đã báo sự cố',
  REVIEWED: 'Đã xem xét',
  ASSIGNED: 'Đã phân công',
  CONTINUED: 'Tiếp tục xử lý',
  REASSIGNED: 'Đã phân công lại',
  TASK_COMPLETED: 'Đã hoàn thành công việc',
  CLOSED: 'Đã đóng sự cố',
}

export const statusLabels = {
  PENDING_REVIEW: 'Chờ xem xét',
  REVIEWED: 'Đã xem xét',
  CONCLUDED: 'Đã kết luận',
  ASSIGNING: 'Đang phân công',
  ASSIGNED: 'Đã phân công',
  CLOSED: 'Đã đóng',
} as const

export const priorityLabels = {
  LOW: 'Thấp',
  NORMAL: 'Bình thường',
  HIGH: 'Cao',
  URGENT: 'Khẩn cấp',
} as const

export const handlingLabels = { SERVICE: 'Dịch vụ', OPERATIONS: 'Vận hành' } as const
export const staffRoleLabels: Record<string, string> = {
  SERVICE_STAFF: 'Nhân viên dịch vụ',
  OPERATIONS_STAFF: 'Nhân viên vận hành',
}

export const issueViews = {
  CUSTOMER: { path: '/customer/issues', title: 'Sự cố của tôi' },
  RECEPTIONIST: { path: '/staff/issues', title: 'Yêu cầu sự cố' },
  MANAGER: { path: '/manager/issues', title: 'Danh sách sự cố' },
} as const

export type IssueRole = keyof typeof issueViews

export function issueRoomLabel(issue: { roomId?: string; roomNumber?: string | null }) {
  if (!issue.roomId) return 'Không gắn với phòng'
  const number = issue.roomNumber?.trim()
  return number ? `Phòng ${number}` : 'Không có thông tin phòng'
}

export function issueDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Không có thời gian hợp lệ' : date.toLocaleString('vi-VN')
}
