import { useState, type FormEvent } from 'react'
import { Alert } from '@/components/Alert'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { SelectField } from '@/components/SelectField'
import { TextAreaField } from '@/components/TextAreaField'
import { getErrorMessage } from '@/lib/api-client'
import { formatDate, formatDateTime } from '@/features/booking/utils'
import type { MyStay } from '../api'
import { useMyStays, useSubmitFeedback } from '../hooks'
import { RatingStars } from '../RatingStars'

const MAX_CONTENT = 2000

const RATING_OPTIONS = [
  { value: '', label: 'Không đánh giá' },
  ...[5, 4, 3, 2, 1].map((stars) => ({ value: String(stars), label: `${stars} sao` })),
]

/** UC39 — Submit Feedback. Khách phản hồi về các lần lưu trú đã trả phòng và xem câu trả lời của khách sạn. */
export function MyFeedbackPage() {
  const stays = useMyStays()

  return (
    <section className="mx-auto max-w-container space-y-6 px-4 py-10 font-body">
      <div>
        <p className="text-xs font-semibold tracking-widest text-primary uppercase">Phản hồi</p>
        <h1 className="font-display text-4xl font-semibold text-pearl-900">Phản hồi của tôi</h1>
        <p className="mt-2 text-sm text-stone-700">
          Chia sẻ trải nghiệm của bạn sau mỗi lần lưu trú. Mỗi lần lưu trú gửi được một phản hồi.
        </p>
      </div>

      {stays.isError && <Alert tone="danger">{getErrorMessage(stays.error)}</Alert>}

      {stays.isPending ? (
        <p className="text-stone-700">Đang tải…</p>
      ) : stays.data && stays.data.items.length === 0 ? (
        <p className="rounded-lg border border-stone-300 bg-white p-6 text-stone-700">
          Chưa có lần lưu trú nào để phản hồi.
        </p>
      ) : (
        stays.data && (
          <div className="space-y-4">
            {stays.data.items.map((stay) => (
              <StayCard key={stay.bookingId} stay={stay} />
            ))}
          </div>
        )
      )}
    </section>
  )
}

function StayCard({ stay }: { stay: MyStay }) {
  const [rating, setRating] = useState('')
  const [content, setContent] = useState('')
  const submit = useSubmitFeedback()
  const sent = stay.feedback

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!content.trim()) return
    try {
      await submit.mutateAsync({
        bookingId: stay.bookingId,
        content: content.trim(),
        ...(rating ? { rating: Number(rating) } : {}),
      })
    } catch {
      // Lỗi hiển thị qua submit.error; giữ nội dung đã nhập.
    }
  }

  return (
    <article
      aria-label={stay.code}
      className="space-y-4 rounded-lg border border-stone-300 bg-white p-6"
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-semibold tracking-wide text-pearl-900">{stay.code}</p>
          <p className="text-sm text-stone-700">
            Lưu trú {formatDate(stay.checkIn)} – {formatDate(stay.checkOut)}
          </p>
        </div>
        {sent && <Badge tone="success">Đã gửi phản hồi</Badge>}
      </header>

      {sent ? (
        <div className="space-y-3">
          {sent.rating && <RatingStars rating={sent.rating} />}
          <p className="text-sm whitespace-pre-line text-pearl-900">{sent.content}</p>
          <p className="text-xs text-stone-500">Gửi lúc {formatDateTime(sent.createdAt)}</p>
          {sent.reply ? (
            <div className="space-y-1 rounded border border-stone-300 bg-cream-50 p-4">
              <p className="text-xs font-semibold tracking-wider text-stone-700 uppercase">
                Phản hồi từ khách sạn
              </p>
              <p className="text-sm whitespace-pre-line text-pearl-900">{sent.reply.content}</p>
              <p className="text-xs text-stone-500">{formatDateTime(sent.reply.repliedAt)}</p>
            </div>
          ) : (
            <p className="text-sm text-stone-700">Chưa có câu trả lời.</p>
          )}
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <SelectField
            label="Đánh giá"
            options={RATING_OPTIONS}
            value={rating}
            onChange={(event) => setRating(event.target.value)}
            className="max-w-xs"
          />
          <TextAreaField
            label="Nội dung phản hồi"
            maxLength={MAX_CONTENT}
            value={content}
            hint={`${content.length}/${MAX_CONTENT}`}
            onChange={(event) => setContent(event.target.value)}
          />
          {submit.isError && <Alert tone="danger">{getErrorMessage(submit.error)}</Alert>}
          <Button type="submit" disabled={!content.trim()} loading={submit.isPending}>
            Gửi phản hồi
          </Button>
        </form>
      )}
    </article>
  )
}
