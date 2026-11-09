/** Loại đơn lễ tân cần chú ý; trùng khoá với `BookingAttention` của API. */
export type AttentionKind = 'overdueCheckOut' | 'overdueCheckIn' | 'dueCheckOut' | 'dueCheckIn'

export const ATTENTION_META: Record<
  AttentionKind,
  { label: string; tone: 'danger' | 'warning'; priority: number }
> = {
  overdueCheckOut: { label: 'Quá hạn trả phòng', tone: 'danger', priority: 0 },
  overdueCheckIn: { label: 'Quá hạn nhận phòng', tone: 'danger', priority: 1 },
  dueCheckOut: { label: 'Trả phòng hôm nay', tone: 'warning', priority: 2 },
  dueCheckIn: { label: 'Nhận phòng hôm nay', tone: 'warning', priority: 3 },
}

/** Thứ tự hiển thị / sắp xếp: quá hạn trước, rồi tới hạn hôm nay. */
export const ATTENTION_ORDER: AttentionKind[] = [
  'overdueCheckOut',
  'overdueCheckIn',
  'dueCheckOut',
  'dueCheckIn',
]

/** Ngày làm việc (YYYY-MM-DD, giờ Việt Nam) của một mốc thời gian ISO. */
function vnDay(iso: string): string {
  const date = new Date(iso)
  return new Date(date.getTime() + (date.getTimezoneOffset() + 420) * 60_000)
    .toISOString()
    .slice(0, 10)
}

/**
 * Phân loại một booking cần lễ tân chú ý so với ngày làm việc `today` (YYYY-MM-DD, giờ VN).
 * Trả về `null` nếu đơn không cần chú ý.
 */
export function classifyAttention(
  booking: { status: string; checkIn: string; checkOut: string },
  today: string,
): AttentionKind | null {
  if (booking.status === 'CHECKED_IN') {
    const day = vnDay(booking.checkOut)
    if (day < today) return 'overdueCheckOut'
    if (day === today) return 'dueCheckOut'
  }
  if (booking.status === 'CONFIRMED') {
    const day = vnDay(booking.checkIn)
    if (day < today) return 'overdueCheckIn'
    if (day === today) return 'dueCheckIn'
  }
  return null
}
