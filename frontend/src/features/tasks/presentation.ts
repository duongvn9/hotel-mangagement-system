import type { TaskStatus } from './api'

export const taskStatuses: Record<TaskStatus, string> = {
  ASSIGNED: 'Đã giao',
  IN_PROGRESS: 'Đang thực hiện',
  COMPLETED: 'Hoàn thành',
  CANCELLED: 'Đã hủy',
}

export const taskSources = {
  SERVICE_ORDER: 'Yêu cầu dịch vụ',
  ISSUE: 'Sự cố',
  MAINTENANCE: 'Bảo trì',
}

export function taskDate(value?: string) {
  return value ? new Date(value).toLocaleString('vi-VN') : 'Chưa có'
}
