import { useId, useState } from 'react'
import { ImageLightbox } from './ImageLightbox'

export function ImagePicker({
  images,
  name,
  onChoose,
  onRemove,
}: {
  images: { src: string; label: string }[]
  name: string
  onChoose: (files: File[]) => void
  onRemove: (index: number) => void
}) {
  const id = useId()
  const [viewing, setViewing] = useState<number | null>(null)
  return (
    <div className="min-w-0 space-y-3 rounded-xl border border-stone-300 bg-cream-100/40 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold">Ảnh tiện nghi</p>
        <span className="rounded-full border border-stone-300 bg-white px-2.5 py-1 text-xs">
          {images.length} / 10 ảnh
        </span>
      </div>
      <input
        id={id}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp"
        aria-label="Ảnh tiện nghi"
        aria-describedby={`${id}-help`}
        className="peer sr-only"
        onChange={(event) => {
          onChoose(Array.from(event.target.files ?? []))
          event.target.value = ''
        }}
      />
      <label
        htmlFor={id}
        className="flex min-h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/40 bg-white px-4 py-5 text-center transition hover:border-primary hover:bg-cream-100 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary peer-disabled:cursor-wait peer-disabled:opacity-50"
      >
        <span
          aria-hidden="true"
          className="flex size-9 items-center justify-center rounded-full bg-cream-100 text-2xl text-primary"
        >
          +
        </span>
        <span className="text-sm font-semibold text-primary">Chọn ảnh từ thiết bị</span>
        <span className="text-xs text-stone-600">Có thể chọn nhiều ảnh cùng lúc</span>
      </label>
      <p id={`${id}-help`} className="text-xs">
        Tối đa 10 ảnh JPG, PNG hoặc WebP, mỗi ảnh tối đa 5 MB. Ảnh đầu tiên là ảnh đại diện.
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {images.map((image, index) => (
          <div
            key={`${image.src}-${index}`}
            className="min-w-0 overflow-hidden rounded-lg border border-stone-300 bg-white shadow-sm"
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
              className="min-h-11 w-full truncate px-2 text-xs text-primary transition hover:bg-cream-100"
            >
              Bỏ ảnh {index + 1}
            </button>
          </div>
        ))}
      </div>
      {viewing !== null && (
        <ImageLightbox
          images={images.map((image) => image.src)}
          name={name || 'Ảnh tiện nghi'}
          startIndex={viewing}
          onClose={() => setViewing(null)}
        />
      )}
    </div>
  )
}
