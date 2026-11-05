import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Stars({ value, onChange }: { value: number; onChange?: (n: number) => void }) {
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
