import { cn } from '@/lib/utils'

const aspectMap = {
  square: 'aspect-square',
  '4/3': 'aspect-[4/3]',
  '3/4': 'aspect-[3/4]',
}

export function PhotoTile({
  src,
  alt,
  caption,
  aspect = '4/3',
  className,
}: {
  src: string
  alt: string
  caption?: string
  aspect?: 'square' | '4/3' | '3/4'
  className?: string
}) {
  return (
    <figure className={cn('group relative overflow-hidden rounded-3xl', className)}>
      <img
        src={src}
        alt={alt}
        loading="lazy"
        className={cn('w-full object-cover transition duration-500', aspectMap[aspect])}
      />
      {caption && (
        <figcaption className="mt-2 text-center text-xs text-muted-foreground">
          {caption}
        </figcaption>
      )}
    </figure>
  )
}
