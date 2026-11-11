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

export function displayText(value: string | null | undefined, fallback: string) {
  const text = value?.trim()
  return text && !/[a-f\d]{24}/i.test(text) ? text : fallback
}

export function personName(value?: string | null) {
  return displayText(value, 'Chưa có thông tin người dùng')
}

export function bookingCode(value?: string | null) {
  return displayText(value, 'Chưa có thông tin đặt phòng')
}

export function taskStatusLabel(value: string) {
  const labels: Record<string, string> = {
    ASSIGNED: 'Đã phân công',
    IN_PROGRESS: 'Đang xử lý',
    COMPLETED: 'Đã hoàn thành',
    CANCELLED: 'Đã hủy',
  }
  return labels[value] ?? 'Chưa có thông tin trạng thái'
}

export function taskTypeLabel(value: string) {
  const labels: Record<string, string> = {
    ISSUE_RESOLUTION: 'Xử lý sự cố',
    SERVICE_EXECUTION: 'Thực hiện dịch vụ',
    MAINTENANCE: 'Bảo trì',
    CHECKOUT_INSPECTION: 'Kiểm tra trả phòng',
  }
  return labels[value] ?? 'Công việc liên quan'
}

export function taskPriorityLabel(value: string) {
  return priorityLabels[value as keyof typeof priorityLabels] ?? 'Chưa có thông tin ưu tiên'
}

export function issueRoomLabel(issue: {
  roomId?: string
  roomNumber?: string | null
  roomNumbers?: string[]
}) {
  if (issue.roomId) {
    return issue.roomNumber?.trim()
      ? displayText(`Phòng ${issue.roomNumber.trim()}`, 'Không có thông tin phòng')
      : 'Không có thông tin phòng'
  }
  const numbers = issue.roomNumbers?.filter((number) => displayText(number, '') !== '')
  return numbers?.length ? `Phòng ${numbers.join(', ')}` : 'Không gắn với phòng'
}

export function issueDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Không có thời gian hợp lệ' : date.toLocaleString('vi-VN')
}
