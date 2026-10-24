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

/** Số đêm giữa hai ngày YYYY-MM-DD (tối thiểu 0). */
export function nightsBetween(checkIn: string, checkOut: string): number {
  const start = Date.parse(`${checkIn}T00:00:00+07:00`)
  const end = Date.parse(`${checkOut}T00:00:00+07:00`)
  if (Number.isNaN(start) || Number.isNaN(end)) return 0
  return Math.max(0, Math.round((end - start) / 86_400_000))
}

/** Ngày hôm nay dạng YYYY-MM-DD theo giờ Việt Nam, để chặn chọn ngày quá khứ. */
export function todayISO(): string {
  const now = new Date()
  const vn = new Date(now.getTime() + (now.getTimezoneOffset() + 420) * 60_000)
  return vn.toISOString().slice(0, 10)
}
