import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export function ImageLightbox({
  images,
  name,
  startIndex = 0,
  onClose,
}: {
  images: string[]
  name: string
  startIndex?: number
  onClose: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const [index, setIndex] = useState(Math.min(startIndex, images.length - 1))
  const [failed, setFailed] = useState<string>()
  const isVector = /\.svg(?:[?#]|$)/i.test(images[index] ?? '')
  const move = (step: number) =>
    setIndex((current) => (current + step + images.length) % images.length)
  useEffect(() => {
    const element = dialog.current!
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    element.showModal()
    return () => {
      element.close()
      document.body.style.overflow = overflow
      previous?.focus()
    }
  }, [])
  return createPortal(
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      className="m-auto max-h-[95dvh] w-[calc(100%_-_1rem)] max-w-5xl overflow-y-auto rounded-2xl border border-stone-300 bg-white p-3 font-body text-pearl-900 shadow-xl backdrop:bg-pearl-900/80 sm:p-5"
      onCancel={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onClose()
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          const rect = event.currentTarget.getBoundingClientRect()
          if (
            event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom
          )
            onClose()
        }
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          event.stopPropagation()
          onClose()
          return
        }
        if (event.key === 'ArrowLeft') {
          event.preventDefault()
          move(-1)
        }
        if (event.key === 'ArrowRight') {
          event.preventDefault()
          move(1)
        }
      }}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 id={titleId} className="truncate font-display text-2xl">
            {name || 'Ảnh loại phòng'}
          </h2>
          <p role="status" aria-live="polite" className="text-sm text-stone-600">
            Ảnh {index + 1} / {images.length}
          </p>
        </div>
        <button
          type="button"
          aria-label="Đóng ảnh"
          onClick={onClose}
          className="flex size-11 shrink-0 items-center justify-center rounded-full border border-stone-300 text-2xl transition hover:bg-cream-100 focus-visible:outline-2 focus-visible:outline-primary"
        >
          ×
        </button>
      </div>
      <div
        className={`relative flex h-[52dvh] min-h-48 items-center justify-center overflow-hidden rounded-xl sm:h-[60dvh] ${isVector ? 'bg-cream-100' : 'bg-pearl-900'}`}
      >
        {failed === images[index] ? (
          <p className="rounded bg-white px-3 py-2 text-pearl-900">Không tải được ảnh này.</p>
        ) : (
          <img
            key={images[index]}
            src={images[index]}
            alt={`${name} — ảnh ${index + 1}`}
            onError={() => setFailed(images[index])}
            className={`h-full w-full object-contain ${isVector ? 'p-8 sm:p-16' : ''}`}
          />
        )}
        {images.length > 1 && (
          <>
            <button
              type="button"
              aria-label="Ảnh trước"
              onClick={() => move(-1)}
              className="absolute left-2 flex size-11 items-center justify-center rounded-full bg-white/95 text-3xl text-pearl-900 shadow-lg transition hover:bg-white focus-visible:outline-2 focus-visible:outline-primary sm:left-4"
            >
              ‹
            </button>
            <button
              type="button"
              aria-label="Ảnh tiếp theo"
              onClick={() => move(1)}
              className="absolute right-2 flex size-11 items-center justify-center rounded-full bg-white/95 text-3xl text-pearl-900 shadow-lg transition hover:bg-white focus-visible:outline-2 focus-visible:outline-primary sm:right-4"
            >
              ›
            </button>
          </>
        )}
      </div>
      {images.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto p-1" aria-label="Chọn ảnh">
          {images.map((src, i) => (
            <button
              key={`${src}-${i}`}
              type="button"
              aria-label={`Xem ảnh ${i + 1}`}
              aria-pressed={index === i}
              onClick={() => setIndex(i)}
              className={`h-16 w-24 shrink-0 overflow-hidden rounded-lg border-2 transition focus-visible:outline-2 focus-visible:outline-primary ${index === i ? 'border-primary ring-2 ring-primary/20' : 'border-transparent opacity-60 hover:opacity-100'}`}
            >
              <img src={src} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </dialog>,
    document.body,
  )
}
