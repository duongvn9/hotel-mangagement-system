import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function HeroBanner({
  image,
  imageAlt,
  title,
  eyebrow,
  children,
  tall = false,
  className,
}: {
  image: string
  imageAlt: string
  title: string
  eyebrow?: string
  children?: ReactNode
  tall?: boolean
  className?: string
}) {
  return (
    <section
      className={cn(
        'relative overflow-hidden',
        tall ? 'h-[92vh] min-h-[640px]' : 'h-[60vh] min-h-[440px]',
        className,
      )}
    >
      <img src={image} alt={imageAlt} className="absolute inset-0 size-full object-cover" />
      <div className="hero-scrim absolute inset-0" />
      <div className="relative mx-auto flex h-full max-w-7xl flex-col justify-end px-5 pb-16 lg:px-8">
        {eyebrow && (
          <p className="mb-4 text-sm tracking-[0.25em] text-ink-foreground/80 uppercase">
            {eyebrow}
          </p>
        )}
        <h1 className="font-display max-w-3xl text-6xl leading-[1.15] text-ink-foreground md:text-8xl">
          {title}
        </h1>
        {children && <div className="mt-10 max-w-4xl">{children}</div>}
      </div>
    </section>
  )
}
