export const statusLabels = {
  PENDING_REVIEW: 'Chờ xem xét',
  REVIEWED: 'Đã xem xét',
  CONCLUDED: 'Đã kết luận',
  ASSIGNING: 'Đang phân công',
  ASSIGNED: 'Đã phân công',
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

export function issueDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Không có thời gian hợp lệ' : date.toLocaleString('vi-VN')
}
