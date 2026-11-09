import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Chấm sao 1-5.
 * - `onChange`: cho chọn sao (nút bấm).
 * - `label`: hiển thị chỉ-đọc cho trình đọc màn hình — render `role="img"` với
 *   `aria-label={label}` (ví dụ "2 trên 5 sao"), không có nút.
 */
export function Stars({
  value,
  onChange,
  label,
}: {
  value: number
  onChange?: (n: number) => void
  label?: string
}) {
  if (label !== undefined && onChange === undefined) {
    return (
      <span role="img" aria-label={label} className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <Star
            key={n}
            className={cn('size-5', n <= value ? 'fill-primary text-primary' : 'text-border')}
          />
        ))}
      </span>
    )
  }
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          type="button"
          key={n}
          disabled={!onChange}
          onClick={() => onChange?.(n)}
          aria-label={`${n} stars`}
        >
          <Star
            className={cn('size-5', n <= value ? 'fill-primary text-primary' : 'text-border')}
          />
        </button>
      ))}
    </div>
  )
}
