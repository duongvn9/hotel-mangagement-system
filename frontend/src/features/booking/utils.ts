/** Tiện ích hiển thị dùng chung cho các màn đặt phòng. */

export const money = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' })

const dateFmt = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium' })
const dateTimeFmt = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' })

/** Hiển thị ngày YYYY-MM-DD hoặc ISO theo định dạng Việt Nam. */
export function formatDate(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : dateFmt.format(date)
}

export function formatDateTime(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : dateTimeFmt.format(date)
}

/** Mốc thời gian của một giá trị ngày: YYYY-MM-DD hiểu theo giờ VN, còn lại parse trực tiếp ISO. */
function instantOf(value: string): number {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? Date.parse(`${value}T00:00:00+07:00`)
    : Date.parse(value)
}

/** Số đêm giữa hai ngày (nhận cả YYYY-MM-DD lẫn ISO datetime từ backend; tối thiểu 0). */
export function nightsBetween(checkIn: string, checkOut: string): number {
  const start = instantOf(checkIn)
  const end = instantOf(checkOut)
  if (Number.isNaN(start) || Number.isNaN(end)) return 0
  return Math.max(0, Math.round((end - start) / 86_400_000))
}

/** Ngày hôm nay dạng YYYY-MM-DD theo giờ Việt Nam, để chặn chọn ngày quá khứ. */
export function todayISO(): string {
  const now = new Date()
  const vn = new Date(now.getTime() + (now.getTimezoneOffset() + 420) * 60_000)
  return vn.toISOString().slice(0, 10)
}

/** Ngày làm việc (YYYY-MM-DD, giờ Việt Nam) của một mốc ISO; giá trị đã là ngày thì giữ nguyên. */
export function toBusinessDate(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const time = Date.parse(value)
  return Number.isNaN(time) ? value : new Date(time + 7 * 3_600_000).toISOString().slice(0, 10)
}

/** Mã chống trùng cho một lần ghi (UC17): gửi lại cùng mã thì server không ghi thêm. */
export function newRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}
