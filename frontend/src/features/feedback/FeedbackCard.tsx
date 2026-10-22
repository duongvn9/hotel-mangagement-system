import { useState, type FormEvent } from 'react'
import { Alert } from '@/components/Alert'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import type { FeedbackItem } from './api'

const formatTime = (iso: string) =>
  new Date(iso).toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    dateStyle: 'short',
    timeStyle: 'short',
  })

interface FeedbackCardProps {
  item: FeedbackItem
  /** Chỉ Lễ tân trả lời được (BR-FB-05). */
  canReply: boolean
  pending: boolean
  error?: string
  onReply(content: string): void
}

export function FeedbackCard({ item, canReply, pending, error, onReply }: FeedbackCardProps) {
  const [open, setOpen] = useState(false)
  const [content, setContent] = useState('')

  function submit(event: FormEvent) {
    event.preventDefault()
    if (content.trim()) onReply(content.trim())
  }

  return (
    <article
      aria-label={`Phản hồi của ${item.customer?.fullName ?? 'khách'}`}
      className="space-y-4 rounded-lg border border-stone-300 bg-white p-6"
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium text-pearl-900">{item.customer?.fullName ?? 'Khách đã xoá'}</p>
          <p className="text-sm text-stone-700">
            {item.customer?.email} · {formatTime(item.createdAt)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {item.rating && (
            <span
              className="text-gold-500"
              role="img"
              aria-label={`${item.rating} trên 5 sao`}
              title={`${item.rating}/5`}
            >
              {'★'.repeat(item.rating)}
              <span className="text-stone-300">{'★'.repeat(5 - item.rating)}</span>
            </span>
          )}
          {item.reply ? (
            <Badge tone="success">Đã trả lời</Badge>
          ) : (
            <Badge tone="warning">Chưa trả lời</Badge>
          )}
        </div>
      </header>

      <p className="whitespace-pre-line text-pearl-900">{item.content}</p>

      {item.reply && (
        <div className="rounded border-l-4 border-gold-500 bg-cream-50 px-4 py-3 text-sm">
          <p className="font-semibold text-pearl-900">
            Khách sạn trả lời
            <span className="font-normal text-stone-700">
              {' '}
              · {item.reply.repliedBy?.fullName ?? 'Nhân viên'} · {formatTime(item.reply.repliedAt)}
            </span>
          </p>
          <p className="mt-1 whitespace-pre-line">{item.reply.content}</p>
        </div>
      )}

      {!item.reply && canReply && !open && (
        <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
          Trả lời
        </Button>
      )}
      {!item.reply && canReply && open && (
        <form onSubmit={submit} className="space-y-3">
          {error && <Alert tone="danger">{error}</Alert>}
          <label className="block">
            <span className="mb-2 block text-xs font-semibold tracking-wider text-stone-700 uppercase">
              Nội dung trả lời<span className="ml-1 text-danger">*</span>
            </span>
            <textarea
              required
              maxLength={2000}
              rows={3}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full rounded border border-stone-300 bg-white px-4 py-3 text-sm hover:border-stone-500 focus:border-primary"
            />
          </label>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" size="sm" onClick={() => setOpen(false)}>
              Huỷ
            </Button>
            <Button type="submit" size="sm" loading={pending}>
              Gửi trả lời
            </Button>
          </div>
        </form>
      )}
    </article>
  )
}
