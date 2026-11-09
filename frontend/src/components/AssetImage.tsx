import { useState } from 'react'
import { assetUrl } from '@/lib/asset-url'
import { ImageLightbox } from './ImageLightbox'

interface Props {
  path?: string
  name: string
  className?: string
  decorative?: boolean
}

/** Remember failures by URL; a new path can load without retrying a broken URL. */
export function AssetImage({
  path,
  name,
  className = 'size-10 rounded object-cover',
  decorative = false,
}: Props) {
  const src = assetUrl(path)
  const [failedSrc, setFailedSrc] = useState<string>()
  const initials =
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0])
      .join('')
      .toUpperCase() || '?'
  if (!src || failedSrc === src) {
    return (
      <span
        role="img"
        aria-label={decorative ? undefined : name}
        aria-hidden={decorative || undefined}
        className={`inline-flex shrink-0 items-center justify-center bg-cream-100 text-sm text-primary ${className}`}
      >
        {initials}
      </span>
    )
  }
  return (
    <img
      src={src}
      alt={decorative ? '' : name}
      loading="lazy"
      className={className}
      onError={() => setFailedSrc(src)}
    />
  )
}

export function RoomGallery({
  images = [],
  name,
  compact = false,
}: {
  images?: string[]
  name: string
  compact?: boolean
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className={compact ? 'flex shrink-0 items-center gap-2' : 'flex items-center gap-2'}>
      {images.length ? (
        <button
          type="button"
          aria-label={`Xem ảnh ${name}`}
          onClick={() => setOpen(true)}
          className={
            compact
              ? 'group relative shrink-0 overflow-hidden rounded-lg focus-visible:outline-2 focus-visible:outline-ring'
              : 'group relative shrink-0 overflow-hidden rounded-lg border border-stone-300 focus-visible:outline-2 focus-visible:outline-primary'
          }
        >
          <AssetImage
            decorative
            path={images[0]}
            name={name}
            className={
              compact
                ? 'size-10 rounded-lg object-cover'
                : 'h-16 w-24 object-cover transition group-hover:scale-105'
            }
          />
          {!compact && images.length > 1 && (
            <span className="absolute bottom-1 right-1 rounded bg-pearl-900/80 px-1.5 py-0.5 text-xs text-white">
              +{images.length - 1}
            </span>
          )}
        </button>
      ) : (
        <AssetImage
          decorative
          name={name}
          className={compact ? 'size-10 rounded-lg bg-surface object-cover' : undefined}
        />
      )}
      {open && (
        <ImageLightbox
          images={images.map((path) => assetUrl(path)!)}
          name={name}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  )
}
