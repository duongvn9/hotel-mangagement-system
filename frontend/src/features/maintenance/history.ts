export const HISTORY_LABELS = {
  ASSIGNED: 'Đã giao',
  IN_PROGRESS: 'Đang xử lý',
  COMPLETED: 'Hoàn thành',
  CANCELLED: 'Đã hủy',
  NO_ACTION: 'Chỉ ghi nhận',
}
const clock = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})
export function historyDate(value?: string) {
  if (!value) return 'Chưa có'
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return 'Không xác định'
  const parts = Object.fromEntries(clock.formatToParts(date).map((p) => [p.type, p.value]))
  return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}`
}
export function displayHistoryDay(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value.split('-').reverse().join('/') : value
}
export function parseHistoryDay(value: string): string | undefined {
  if (!value.trim()) return ''
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(value)) return undefined
  const iso = value.split('/').reverse().join('-')
  const date = new Date(`${iso}T00:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === iso
    ? iso
    : undefined
}
