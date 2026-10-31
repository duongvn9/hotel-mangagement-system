import { useState } from 'react'
import { assetUrl } from '@/lib/asset-url'

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

export function RoomGallery({ images = [], name }: { images?: string[]; name: string }) {
  return (
    <div className="flex items-center gap-2">
      <AssetImage decorative path={images[0]} name={name} />
      {images.length > 1 && (
        <details>
          <summary className="cursor-pointer text-xs text-primary">
            +{images.length - 1} ảnh
          </summary>
          <div className="flex flex-wrap gap-2 py-2">
            {images.map((path, index) => (
              <AssetImage
                key={path + index}
                path={path}
                name={`${name} — ${index + 1}`}
                className="h-20 w-28 rounded object-cover"
              />
            ))}
          </div>
        </details>
      )}
    </div>
  )
}
