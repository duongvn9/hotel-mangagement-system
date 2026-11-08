import { useId, useState } from 'react'
import { ImageLightbox } from './ImageLightbox'
import { cn } from '@/lib/utils'

export function ImagePicker({
  images,
  name,
  onChoose,
  onRemove,
  label = 'Ảnh tiện nghi',
  appearance = 'legacy',
}: {
  images: { src: string; label: string }[]
  name: string
  onChoose: (files: File[]) => void
  onRemove: (index: number) => void
  label?: string
  appearance?: 'legacy' | 'prototype'
}) {
  const id = useId()
  const [viewing, setViewing] = useState<number | null>(null)
  const polished = appearance === 'prototype'
  return (
    <div
      className={cn(
        'min-w-0 space-y-3 rounded-xl border p-4',
        polished ? 'border-border bg-surface/40' : 'border-stone-300 bg-cream-100/40',
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold">{label}</p>
        <span
          className={cn(
            'shrink-0 rounded-full border px-2.5 py-1 text-xs',
            polished ? 'border-border bg-card' : 'border-stone-300 bg-white',
          )}
        >
          {images.length} / 1 ảnh
        </span>
      </div>
      <input
        id={id}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        aria-label={label}
        aria-describedby={`${id}-help`}
        className="peer sr-only"
        onChange={(event) => {
          onChoose(Array.from(event.target.files ?? []))
          event.target.value = ''
        }}
      />
      <label
        htmlFor={id}
        className={cn(
          'flex min-h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/40 px-4 py-5 text-center transition hover:border-primary peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary peer-disabled:cursor-wait peer-disabled:opacity-50',
          polished ? 'bg-card hover:bg-surface' : 'bg-white hover:bg-cream-100',
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            'flex size-9 items-center justify-center rounded-full text-2xl text-primary',
            polished ? 'bg-surface' : 'bg-cream-100',
          )}
        >
          +
        </span>
        <span className="text-sm font-semibold text-primary">Chọn ảnh từ thiết bị</span>
        <span className={cn('text-xs', polished ? 'text-muted-foreground' : 'text-stone-600')}>
          Chọn ảnh mới để thay ảnh hiện tại
        </span>
      </label>
      <p id={`${id}-help`} className="text-xs">
        Một ảnh JPG, PNG hoặc WebP, tối đa 5 MB.
      </p>
      <div className="mx-auto w-full max-w-64">
        {images.map((image, index) => (
          <div
            key={`${image.src}-${index}`}
            className={cn(
              'min-w-0 overflow-hidden rounded-lg border shadow-sm',
              polished ? 'border-border bg-card' : 'border-stone-300 bg-white',
            )}
          >
            <button
              type="button"
              aria-label={`Phóng to ảnh ${index + 1}`}
              onClick={() => setViewing(index)}
              className="group block w-full overflow-hidden focus-visible:outline-2 focus-visible:outline-primary"
            >
              <img
                src={image.src}
                alt={image.label}
                className="aspect-[4/3] w-full object-contain p-2 transition group-hover:scale-105"
              />
            </button>
            <button
              type="button"
              onClick={() => onRemove(index)}
              className={cn(
                'min-h-11 w-full truncate px-2 text-xs text-primary transition',
                polished
                  ? 'hover:bg-surface focus-visible:outline-2 focus-visible:outline-ring'
                  : 'hover:bg-cream-100',
              )}
            >
              Bỏ ảnh {index + 1}
            </button>
          </div>
        ))}
      </div>
      {viewing !== null && (
        <ImageLightbox
          images={images.map((image) => image.src)}
          name={name || label}
          startIndex={viewing}
          onClose={() => setViewing(null)}
        />
      )}
    </div>
  )
}
