import type { TaskStatus } from './api'

export const taskStatuses: Record<TaskStatus, string> = {
  ASSIGNED: 'Đã giao',
  IN_PROGRESS: 'Đang thực hiện',
  COMPLETED: 'Hoàn thành',
  CANCELLED: 'Đã hủy',
}

export const taskTypes: Record<string, string> = {
  SERVICE_ORDER_EXECUTION: 'Thực hiện yêu cầu dịch vụ',
  ISSUE_RESOLUTION: 'Xử lý sự cố',
  ROOM_CHECK: 'Kiểm tra phòng',
  MAINTENANCE: 'Bảo trì',
  CHECKOUT_INSPECTION: 'Kiểm tra trả phòng',
}

export function taskTypeLabel(type: string) {
  return taskTypes[type] ?? 'Công việc khác'
}

export const taskSources = {
  SERVICE_ORDER: 'Yêu cầu dịch vụ',
  ISSUE: 'Sự cố',
  MAINTENANCE: 'Bảo trì',
  CHECKOUT_INSPECTION: 'Kiểm tra trả phòng',
}

export function taskDate(value?: string) {
  return value ? new Date(value).toLocaleString('vi-VN') : 'Chưa có'
}
