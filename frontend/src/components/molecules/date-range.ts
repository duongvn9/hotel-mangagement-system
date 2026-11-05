import { addDays, format } from 'date-fns'

const iso = (d: Date) => format(d, 'yyyy-MM-dd')

/** Chuẩn hóa khoảng ngày chọn từ lịch: ngày trả luôn sau ngày nhận ít nhất 1 ngày. */
export function normalizeRange(from: Date, to?: Date): [string, string] {
  const end = to && to > from ? to : addDays(from, 1)
  return [iso(from), iso(end)]
}
