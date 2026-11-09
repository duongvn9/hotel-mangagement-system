import { TriangleAlert } from 'lucide-react'
import { Link } from 'react-router'
import { Badge } from '@/components/atoms'
import { ATTENTION_ORDER, ATTENTION_META } from '../attention'
import { useBookingAttention } from '../hooks'

/**
 * Cảnh báo cho lễ tân về các đơn quá hạn hoặc sắp tới hạn cần xử lý.
 * Không hiện gì khi đang tải, lỗi, hoặc không có đơn nào cần chú ý.
 * `showLink` bật liên kết sang danh sách đặt phòng (tắt khi đã ở chính trang đó).
 */
export function BookingAttentionAlert({ showLink = true }: { showLink?: boolean }) {
  const query = useBookingAttention()
  const data = query.data
  if (!data) return null
  const kinds = ATTENTION_ORDER.filter((kind) => data[kind] > 0)
  if (!kinds.length) return null
  return (
    <section
      aria-label="Đơn cần xử lý"
      className="rounded-xl border border-warning/30 bg-warning/5 p-4 shadow-soft sm:p-5"
    >
      <div className="flex items-center gap-2">
        <TriangleAlert className="size-5 text-warning" aria-hidden />
        <h2 className="font-semibold text-foreground">Đơn cần xử lý</h2>
      </div>
      <ul className="mt-3 flex flex-wrap gap-2">
        {kinds.map((kind) => (
          <li key={kind}>
            <Badge tone={ATTENTION_META[kind].tone} className="gap-1.5 px-3 py-1 text-sm">
              {ATTENTION_META[kind].label}
              <strong className="tabular-nums">{data[kind]}</strong>
            </Badge>
          </li>
        ))}
      </ul>
      {showLink && (
        <Link
          to="/reception/bookings"
          className="mt-3 inline-flex min-h-11 items-center text-sm text-primary underline underline-offset-4 hover:text-primary/80"
        >
          Xem danh sách đặt phòng
        </Link>
      )}
    </section>
  )
}
