import { BedDouble } from 'lucide-react'
import type { ReactNode } from 'react'
import { vnd } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Checkbox } from '../atoms'

export interface RoomCardProps {
  image?: string
  name: string
  description?: string
  amenities?: string[]
  price?: number
  priceNote?: string
  meta?: ReactNode
  actions?: ReactNode
  selected?: boolean
  onToggle?: () => void
  toggleLabel?: string
  className?: string
}

export function RoomCard({
  image,
  name,
  description,
  amenities,
  price,
  priceNote,
  meta,
  actions,
  selected = false,
  onToggle,
  toggleLabel,
  className,
}: RoomCardProps) {
  return (
    <div
      className={cn(
        'card-soft grid overflow-hidden transition-colors md:grid-cols-[320px_1fr]',
        selected && 'border-primary ring-1 ring-primary',
        className,
      )}
    >
      <div className="relative h-56 w-full md:h-full">
        {image ? (
          <img src={image} alt={name} loading="lazy" className="size-full object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center bg-surface text-muted-foreground">
            <BedDouble className="size-12 opacity-40" />
          </div>
        )}
        {onToggle && (
          <div className="absolute top-3 left-3 rounded-lg bg-card/80 p-1.5 shadow-sm backdrop-blur">
            <Checkbox
              checked={selected}
              onCheckedChange={() => onToggle()}
              aria-label={toggleLabel ?? `Chọn phòng ${name}`}
            />
          </div>
        )}
      </div>

      <div className="flex flex-col p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h2 className="font-display line-clamp-2 text-3xl">{name}</h2>
            {meta && <div className="mt-2 text-sm text-muted-foreground">{meta}</div>}
          </div>
        </div>

        {description && (
          <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{description}</p>
        )}

        {amenities && amenities.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {amenities.slice(0, 4).map((a) => (
              <span key={a} className="rounded-full bg-surface px-3 py-1 text-xs">
                {a}
              </span>
            ))}
            {amenities.length > 4 && (
              <span className="rounded-full bg-surface px-3 py-1 text-xs">
                +{amenities.length - 4}
              </span>
            )}
          </div>
        )}

        <div className="mt-auto flex flex-wrap items-end justify-between gap-4 pt-6">
          {price !== undefined ? (
            <div>
              <div className="text-xl font-semibold">
                {vnd(price)}
                <span className="text-sm font-normal text-muted-foreground">
                  {' '}
                  {priceNote ?? '/ đêm'}
                </span>
              </div>
            </div>
          ) : (
            <div />
          )}
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      </div>
    </div>
  )
}
