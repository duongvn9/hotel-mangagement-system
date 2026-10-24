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
