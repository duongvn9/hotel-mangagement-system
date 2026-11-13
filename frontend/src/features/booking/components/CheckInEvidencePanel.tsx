import { useState } from 'react'
import { ImageLightbox } from '@/components/ImageLightbox'
import { Panel } from '@/components/organisms'
import { useCheckInEvidence } from '../hooks'

const CHECKED_IN_STATUSES = ['CHECKED_IN', 'CHECKED_OUT']

/** ID photos reception attached at check-in; hidden before check-in or when there are none. */
export function CheckInEvidencePanel({ bookingId, status }: { bookingId: string; status: string }) {
  const evidence = useCheckInEvidence(bookingId, CHECKED_IN_STATUSES.includes(status))
  const [viewing, setViewing] = useState<number | null>(null)
  const photos = evidence.data ?? []

  if (photos.length === 0) return null

  return (
    <Panel title="Ảnh giấy tờ">
      <ul className="flex flex-wrap gap-3">
        {photos.map((src, index) => (
          <li key={index}>
            <button
              type="button"
              aria-label={`Xem ảnh giấy tờ ${index + 1}`}
              className="w-fit rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              onClick={() => setViewing(index)}
            >
              <img
                src={src}
                alt={`Ảnh giấy tờ ${index + 1}`}
                className="h-32 w-48 rounded-lg border border-border object-cover"
              />
            </button>
          </li>
        ))}
      </ul>
      {viewing !== null && (
        <ImageLightbox
          images={photos}
          name="Ảnh giấy tờ"
          startIndex={viewing}
          onClose={() => setViewing(null)}
        />
      )}
    </Panel>
  )
}
