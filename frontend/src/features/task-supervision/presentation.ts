import type { QueueStatus, QueueSource } from './api'

export const QUEUE_STATES: QueueStatus[] = ['ASSIGNED', 'IN_PROGRESS', 'COMPLETED']
export const QUEUE_LABELS: Record<QueueStatus, string> = {
  ASSIGNED: 'Chờ/Đã giao',
  IN_PROGRESS: 'Đang xử lý',
  COMPLETED: 'Hoàn thành',
}
export const SOURCE_LABELS: Record<QueueSource, string> = {
  SERVICE_ORDER: 'Yêu cầu dịch vụ',
  ISSUE: 'Sự cố',
  MAINTENANCE: 'Bảo trì',
}
const priorityLabels: Record<string, string> = {
  LOW: 'Thấp',
  NORMAL: 'Bình thường',
  HIGH: 'Cao',
  URGENT: 'Khẩn cấp',
}
/** Display only: no enum, ordering rule or case normalization for free-string priorities. */
export const priorityLabel = (value?: string | null) =>
  value ? (Object.hasOwn(priorityLabels, value) ? priorityLabels[value] : value) : '—'
export const priorityOption = (value: string) =>
  priorityLabel(value) === value ? value : `${priorityLabel(value)} (${value})`
const clock = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})
export function queueDate(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return '—'
  const p = Object.fromEntries(clock.formatToParts(date).map((part) => [part.type, part.value]))
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`
}
export const queueTime = (value: string) => queueDate(value).slice(-5)
