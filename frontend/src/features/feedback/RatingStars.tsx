import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Điểm 1-5 sao, đọc được bằng trình đọc màn hình ("4 trên 5 sao"). */
export function RatingStars({ rating }: { rating: number }) {
  return (
    <span
      className="inline-flex items-center gap-0.5"
      role="img"
      aria-label={`${rating} trên 5 sao`}
      title={`${rating}/5`}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={cn('size-4', n <= rating ? 'fill-primary text-primary' : 'text-border')}
        />
      ))}
    </span>
  )
}
