import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function SectionHeading({
  eyebrow,
  title,
  body,
  align = 'left',
  as: Component = 'h2',
  className,
}: {
  eyebrow?: string
  title: string
  body?: ReactNode
  align?: 'left' | 'center'
  as?: 'h1' | 'h2'
  className?: string
}) {
  const isCenter = align === 'center'
  return (
    <div className={cn(isCenter && 'text-center', className)}>
      {eyebrow && <p className="text-xs tracking-[0.2em] text-primary uppercase">{eyebrow}</p>}
      <Component className={cn('font-display text-5xl leading-[1.2]', eyebrow && 'mt-3')}>
        {title}
      </Component>
      {body && (
        <p
          className={cn('mt-4 text-muted-foreground', isCenter ? 'mx-auto max-w-2xl' : 'max-w-md')}
        >
          {body}
        </p>
      )}
    </div>
  )
}
