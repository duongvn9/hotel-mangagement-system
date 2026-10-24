import type { Booking, PaymentResultStatus } from './api'

/**
 * Backend chưa có GET để đọc lại booking/invoice, nên lưu các booking vừa tạo ở localStorage
 * để màn "Đặt phòng của tôi" và trang chi tiết dùng lại được trên cùng thiết bị.
 * Chỉ là tiện ích phía người dùng (per-viewer): mọi thao tác đổi trạng thái vẫn do backend quyết.
 */

const KEY = 'hms.my-bookings'

export interface StoredBooking extends Booking {
  /** Thời điểm lưu (ISO) để sắp xếp mới nhất lên đầu. */
  savedAt: string
  /** Kết quả thanh toán cọc gần nhất quan sát được ở trang Return. */
  depositResult?: PaymentResultStatus
}

function readAll(): StoredBooking[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as StoredBooking[]) : []
  } catch {
    return []
  }
}

function writeAll(bookings: StoredBooking[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(bookings))
  } catch {
    // Chế độ riêng tư / bị chặn storage: bỏ qua, màn vẫn chạy được.
  }
}

/** Danh sách booking đã lưu, mới nhất trước. */
export function listStoredBookings(): StoredBooking[] {
  return readAll().sort((a, b) => b.savedAt.localeCompare(a.savedAt))
}

export function getStoredBooking(id: string): StoredBooking | undefined {
  return readAll().find((booking) => booking.id === id)
}

/** Thêm mới hoặc cập nhật một booking theo id. */
export function upsertStoredBooking(booking: Booking, extra: Partial<StoredBooking> = {}): void {
  const all = readAll()
  const index = all.findIndex((item) => item.id === booking.id)
  const next: StoredBooking = {
    ...(index >= 0 ? all[index] : {}),
    ...booking,
    ...extra,
    savedAt: new Date().toISOString(),
  }
  if (index >= 0) all[index] = next
  else all.push(next)
  writeAll(all)
}

/** Ghi đè một vài trường (vd: trạng thái, kết quả thanh toán) nếu booking đã có. */
export function patchStoredBooking(id: string, patch: Partial<StoredBooking>): void {
  const all = readAll()
  const index = all.findIndex((item) => item.id === id)
  if (index < 0) return
  all[index] = { ...all[index], ...patch }
  writeAll(all)
}

export function removeStoredBooking(id: string): void {
  writeAll(readAll().filter((booking) => booking.id !== id))
}

const REF_KEY = 'hms.payment-refs'

/** Nhớ giao dịch VNPay thuộc booking nào, để trang Return biết cập nhật booking nào. */
export function rememberPaymentRef(transactionRef: string, bookingId: string): void {
  try {
    const map = JSON.parse(localStorage.getItem(REF_KEY) ?? '{}') as Record<string, string>
    map[transactionRef] = bookingId
    localStorage.setItem(REF_KEY, JSON.stringify(map))
  } catch {
    // Bỏ qua khi storage không dùng được.
  }
}

export function lookupPaymentRef(transactionRef: string): string | undefined {
  try {
    const map = JSON.parse(localStorage.getItem(REF_KEY) ?? '{}') as Record<string, string>
    return map[transactionRef]
  } catch {
    return undefined
  }
}
