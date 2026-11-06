import { useState, type FormEvent } from 'react'
import { Badge, Button, NativeSelect, Textarea } from '@/components/atoms'
import { Alert, FormField } from '@/components/molecules'
import { PageContainer, PageHeader, Panel } from '@/components/organisms'
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
    <PageContainer className="space-y-6">
      <PageHeader
        eyebrow="Phản hồi"
        title="Phản hồi của tôi"
        subtitle="Chia sẻ trải nghiệm của bạn sau mỗi lần lưu trú. Mỗi lần lưu trú gửi được một phản hồi."
      />

      {stays.isError && <Alert tone="danger">{getErrorMessage(stays.error)}</Alert>}

      {stays.isPending ? (
        <p className="text-sm text-muted-foreground">Đang tải…</p>
      ) : stays.data && stays.data.items.length === 0 ? (
        <Panel>
          <p className="text-sm text-muted-foreground">Chưa có lần lưu trú nào để phản hồi.</p>
        </Panel>
      ) : (
        stays.data && (
          <div className="space-y-4">
            {stays.data.items.map((stay) => (
              <StayCard key={stay.bookingId} stay={stay} />
            ))}
          </div>
        )
      )}
    </PageContainer>
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
    <article aria-label={stay.code} className="card-soft space-y-4 p-5 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b pb-4">
        <div>
          <p className="font-semibold tracking-wide text-foreground">{stay.code}</p>
          <p className="text-sm text-muted-foreground">
            Lưu trú {formatDate(stay.checkIn)} – {formatDate(stay.checkOut)}
          </p>
        </div>
        {sent && <Badge tone="success">Đã gửi phản hồi</Badge>}
      </header>

      {sent ? (
        <div className="space-y-3">
          {sent.rating && <RatingStars rating={sent.rating} />}
          <p className="text-sm whitespace-pre-line text-foreground">{sent.content}</p>
          <p className="text-xs text-muted-foreground">Gửi lúc {formatDateTime(sent.createdAt)}</p>
          {sent.reply ? (
            <div className="space-y-1 rounded-xl border bg-surface p-4">
              <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                Phản hồi từ khách sạn
              </p>
              <p className="text-sm whitespace-pre-line text-foreground">{sent.reply.content}</p>
              <p className="text-xs text-muted-foreground">
                {formatDateTime(sent.reply.repliedAt)}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Chưa có câu trả lời.</p>
          )}
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <FormField label="Đánh giá" htmlFor={`rating-${stay.bookingId}`} className="max-w-xs">
            <NativeSelect
              id={`rating-${stay.bookingId}`}
              value={rating}
              onChange={(event) => setRating(event.target.value)}
            >
              {RATING_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField
            label="Nội dung phản hồi"
            htmlFor={`content-${stay.bookingId}`}
            hint={`${content.length}/${MAX_CONTENT}`}
          >
            <Textarea
              id={`content-${stay.bookingId}`}
              maxLength={MAX_CONTENT}
              value={content}
              onChange={(event) => setContent(event.target.value)}
              rows={4}
            />
          </FormField>
          {submit.isError && <Alert tone="danger">{getErrorMessage(submit.error)}</Alert>}
          <Button
            type="submit"
            disabled={!content.trim() || submit.isPending}
            className="rounded-full"
          >
            Gửi phản hồi
          </Button>
        </form>
      )}
    </article>
  )
}
