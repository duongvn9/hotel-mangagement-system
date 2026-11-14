import { TriangleAlert } from 'lucide-react'
import { Link } from 'react-router'
import { Badge } from '@/components/atoms'
import { cn } from '@/lib/utils'
import { ATTENTION_ORDER, ATTENTION_META, type AttentionKind } from '../attention'
import { useBookingAttention } from '../hooks'

/**
 * Cảnh báo cho lễ tân về các đơn quá hạn hoặc sắp tới hạn cần xử lý.
 * Không hiện gì khi đang tải, lỗi, hoặc không có đơn nào cần chú ý.
 * `showLink` bật liên kết sang danh sách đặt phòng (tắt khi đã ở chính trang đó).
 * With `onSelect`, each chip is a toggle button that filters the list to its category;
 * clicking the selected chip again calls `onSelect(null)`.
 */
export function BookingAttentionAlert({
  showLink = true,
  selected = null,
  onSelect,
}: {
  showLink?: boolean
  selected?: AttentionKind | null
  onSelect?: (kind: AttentionKind | null) => void
}) {
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
            {onSelect ? (
              <button
                type="button"
                aria-pressed={selected === kind}
                onClick={() => onSelect(selected === kind ? null : kind)}
                className={cn(
                  'cursor-pointer rounded-full transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                  selected === kind && 'ring-2 ring-ring ring-offset-2 ring-offset-background',
                )}
              >
                <Badge tone={ATTENTION_META[kind].tone} className="gap-1.5 px-3 py-1 text-sm">
                  {ATTENTION_META[kind].label}
                  <strong className="tabular-nums">{data[kind]}</strong>
                </Badge>
              </button>
            ) : (
              <Badge tone={ATTENTION_META[kind].tone} className="gap-1.5 px-3 py-1 text-sm">
                {ATTENTION_META[kind].label}
                <strong className="tabular-nums">{data[kind]}</strong>
              </Badge>
            )}
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
