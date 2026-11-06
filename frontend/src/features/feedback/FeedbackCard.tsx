import { useId, useState, type FormEvent } from 'react'
import { Button, Textarea } from '@/components/atoms'
import { FormField, Stars } from '@/components/molecules'
import { cn } from '@/lib/utils'
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

/** Chấm màu + chữ cho trạng thái trả lời (không chỉ dựa vào màu). */
function ReplyMarker({ replied }: { replied: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-[13px] font-medium whitespace-nowrap',
        replied ? 'text-success' : 'text-warning',
      )}
    >
      <span className="size-1.5 shrink-0 rounded-full bg-current" />
      {replied ? 'Đã trả lời' : 'Chưa trả lời'}
    </span>
  )
}

export function FeedbackCard({ item, canReply, pending, error, onReply }: FeedbackCardProps) {
  const [open, setOpen] = useState(false)
  const [content, setContent] = useState('')
  const fieldId = useId()

  function submit(event: FormEvent) {
    event.preventDefault()
    if (content.trim()) onReply(content.trim())
  }

  return (
    <article
      aria-label={`Phản hồi của ${item.customer?.fullName ?? 'khách'}`}
      className="card-soft space-y-3 p-5"
    >
      <div className="flex items-start justify-between gap-3">
        {item.rating ? (
          <Stars value={item.rating} label={`${item.rating} trên 5 sao`} />
        ) : (
          <span className="text-xs text-muted-foreground">Không chấm sao</span>
        )}
        <div className="text-right">
          <ReplyMarker replied={Boolean(item.reply)} />
          <p className="mt-1 text-xs text-muted-foreground">
            {item.customer?.email} · {formatTime(item.createdAt)}
          </p>
        </div>
      </div>

      <p className="whitespace-pre-line">{item.content}</p>
      <p className="text-sm text-muted-foreground">— {item.customer?.fullName ?? 'Khách đã xoá'}</p>

      {item.reply && (
        <div className="rounded-lg bg-surface p-3 text-sm">
          <p>
            <b>Phản hồi:</b> {item.reply.content}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {item.reply.repliedBy?.fullName ?? 'Nhân viên'} · {formatTime(item.reply.repliedAt)}
          </p>
        </div>
      )}

      {!item.reply && canReply && !open && (
        <Button variant="outline" size="sm" className="rounded-full" onClick={() => setOpen(true)}>
          Trả lời
        </Button>
      )}
      {!item.reply && canReply && open && (
        <form onSubmit={submit} className="space-y-3">
          {error && (
            <p
              role="alert"
              className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </p>
          )}
          <FormField label="Nội dung trả lời" htmlFor={fieldId} required>
            <Textarea
              id={fieldId}
              required
              maxLength={2000}
              rows={3}
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </FormField>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full"
              onClick={() => setOpen(false)}
            >
              Huỷ
            </Button>
            <Button type="submit" size="sm" className="rounded-full" disabled={pending}>
              {pending ? 'Đang gửi…' : 'Gửi trả lời'}
            </Button>
          </div>
        </form>
      )}
    </article>
  )
}
