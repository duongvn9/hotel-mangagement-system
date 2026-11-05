import { Link } from 'react-router'
import { cn } from '@/lib/utils'

export function Logo({ light, to = '/' }: { light?: boolean; to?: string }) {
  return (
    <Link
      to={to}
      className={cn(
        'flex shrink-0 items-center gap-2 text-lg font-semibold tracking-tight whitespace-nowrap',
        light ? 'text-ink-foreground' : 'text-foreground',
      )}
    >
      <span className="font-display grid size-8 place-items-center rounded-full bg-primary text-lg text-primary-foreground">
        P
      </span>
      Emily Hotel
    </Link>
  )
}
