import { Link } from 'react-router'
import { cn } from '@/lib/utils'

export function Logo({
  light,
  to = '/',
  name = 'Emily Hotel',
}: {
  light?: boolean
  to?: string
  name?: string
}) {
  const initial = name.trim().charAt(0).toUpperCase()
  return (
    <Link
      to={to}
      className={cn(
        'flex shrink-0 items-center gap-2 text-lg font-semibold tracking-tight whitespace-nowrap',
        light ? 'text-ink-foreground' : 'text-foreground',
      )}
    >
      <span className="font-display grid size-8 place-items-center rounded-full bg-primary text-lg text-primary-foreground">
        {initial}
      </span>
      {name}
    </Link>
  )
}
