import { useState, type FormEvent } from 'react'
import { Button, NativeSelect, Textarea } from '@/components/atoms'
import { Alert, EmptyState, Stars } from '@/components/molecules'
import { PageContainer, PageHeader, Panel } from '@/components/organisms'
import { getErrorMessage } from '@/lib/api-client'
import { fdate } from '@/lib/format'
import { useMyStays, useSubmitFeedback } from '../hooks'

const MAX_CONTENT = 2000

/**
 * UC39 — Submit Feedback, theo màn app.feedback của prototype: viết đánh giá cho một lần lưu
 * trú đã trả phòng (mỗi lần lưu trú một đánh giá) bên cạnh các đánh giá đã gửi và câu trả lời của
 * khách sạn.
 */
export function MyFeedbackPage() {
  const stays = useMyStays()
  const submit = useSubmitFeedback()
  const [bookingId, setBookingId] = useState('')
  const [rating, setRating] = useState(0)
  const [content, setContent] = useState('')

  const items = stays.data?.items ?? []
  const toReview = items.filter((stay) => stay.feedback === null)
  const mine = items.filter((stay) => stay.feedback !== null)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!bookingId || !content.trim()) return
    try {
      await submit.mutateAsync({
        bookingId,
        content: content.trim(),
        ...(rating > 0 ? { rating } : {}),
      })
      setBookingId('')
      setRating(0)
      setContent('')
    } catch {
      // Lỗi hiển thị qua submit.error; giữ nội dung đã nhập.
    }
  }

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        title="Đánh giá"
        subtitle="Hãy kể về kỳ nghỉ của bạn — ban quản lý đọc mọi đánh giá."
      />

      {stays.isError && <Alert tone="danger">{getErrorMessage(stays.error)}</Alert>}
      {stays.isPending && <p className="text-sm text-muted-foreground">Đang tải…</p>}

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Viết đánh giá">
          {toReview.length === 0 ? (
            <EmptyState
              title="Chưa có gì để đánh giá"
              body="Sau khi trả phòng, bạn có thể đánh giá kỳ nghỉ tại đây."
            />
          ) : (
            <form onSubmit={onSubmit} className="grid gap-4">
              <NativeSelect
                aria-label="Kỳ lưu trú"
                value={bookingId}
                onChange={(event) => setBookingId(event.target.value)}
              >
                <option value="">Chọn kỳ lưu trú đã hoàn thành</option>
                {toReview.map((stay) => (
                  <option key={stay.bookingId} value={stay.bookingId}>
                    {stay.code} · {fdate(stay.checkOut)}
                  </option>
                ))}
              </NativeSelect>
              <Stars value={rating} onChange={(n) => setRating(n === rating ? 0 : n)} />
              <Textarea
                aria-label="Nội dung đánh giá"
                rows={5}
                maxLength={MAX_CONTENT}
                placeholder="Điều gì ấn tượng? Điều gì cần cải thiện?"
                value={content}
                onChange={(event) => setContent(event.target.value)}
              />
              {submit.isError && <Alert tone="danger">{getErrorMessage(submit.error)}</Alert>}
              <Button
                type="submit"
                className="w-fit rounded-full"
                disabled={!bookingId || !content.trim() || submit.isPending}
              >
                Gửi đánh giá
              </Button>
            </form>
          )}
        </Panel>

        <Panel title="Đánh giá của tôi">
          {mine.length === 0 ? (
            <p className="text-sm text-muted-foreground">Bạn chưa có đánh giá nào.</p>
          ) : (
            mine.map(({ bookingId: id, code, feedback }) => (
              <div key={id} className="border-b py-4 first:pt-0 last:border-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {feedback?.rating ? (
                    <Stars value={feedback.rating} label={`${feedback.rating} trên 5 sao`} />
                  ) : (
                    <span />
                  )}
                  <span className="text-xs text-muted-foreground">
                    {code} · {fdate(feedback?.createdAt ?? '')}
                  </span>
                </div>
                <p className="mt-2 text-sm whitespace-pre-line break-words">{feedback?.content}</p>
                {feedback?.reply && (
                  <p className="mt-2 rounded-lg bg-surface p-3 text-sm text-muted-foreground">
                    <b className="text-foreground">Khách sạn phản hồi:</b> {feedback.reply.content}
                  </p>
                )}
              </div>
            ))
          )}
        </Panel>
      </div>
    </PageContainer>
  )
}
