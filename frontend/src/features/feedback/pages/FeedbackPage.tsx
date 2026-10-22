import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Alert } from '@/components/Alert'
import { Button } from '@/components/Button'
import { SelectField } from '@/components/SelectField'
import { TextField } from '@/components/TextField'
import { Role } from '@/features/auth/api'
import { useAuth } from '@/features/auth/auth-context'
import { getErrorMessage } from '@/lib/api-client'
import { listFeedback, replyFeedback, type FeedbackQuery } from '../api'
import { FeedbackCard } from '../FeedbackCard'

const LIMIT = 10

/** UC40 View Feedback List (Lễ tân, Manager) + UC41 Reply to Feedback (chỉ Lễ tân). */
export function FeedbackPage() {
  const { me } = useAuth()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState<FeedbackQuery>({ page: 1, limit: LIMIT })
  const [replyingId, setReplyingId] = useState<string>()

  const { data, isPending, isError } = useQuery({
    queryKey: ['feedback', query],
    queryFn: () => listFeedback(query),
    placeholderData: keepPreviousData,
  })
  const reply = useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) => replyFeedback(id, content),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['feedback'] }),
  })

  const filter = (patch: Partial<FeedbackQuery>) => setQuery((q) => ({ ...q, ...patch, page: 1 }))
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1

  function onSearch(event: FormEvent) {
    event.preventDefault()
    filter({ search: search.trim() || undefined })
  }

  return (
    <section className="mx-auto max-w-container space-y-6 px-4 py-10">
      <div>
        <p className="text-xs font-semibold tracking-widest text-primary uppercase">
          Chăm sóc khách
        </p>
        <h1 className="font-display text-4xl font-semibold text-pearl-900">Phản hồi của khách</h1>
      </div>

      <form onSubmit={onSearch} className="grid gap-4 md:grid-cols-[2fr_1fr_1fr_auto]">
        <TextField
          label="Tìm kiếm"
          type="search"
          placeholder="Nội dung, tên hoặc email khách"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <SelectField
          label="Số sao"
          options={[
            { value: '', label: 'Tất cả' },
            ...[5, 4, 3, 2, 1].map((n) => ({ value: String(n), label: `${n} sao` })),
          ]}
          value={query.rating ? String(query.rating) : ''}
          onChange={(e) => filter({ rating: e.target.value ? Number(e.target.value) : undefined })}
        />
        <SelectField
          label="Trạng thái"
          options={[
            { value: '', label: 'Tất cả' },
            { value: 'false', label: 'Chưa trả lời' },
            { value: 'true', label: 'Đã trả lời' },
          ]}
          value={query.replied ?? ''}
          onChange={(e) =>
            filter({ replied: (e.target.value || undefined) as FeedbackQuery['replied'] })
          }
        />
        <Button type="submit" variant="secondary" className="self-end">
          Tìm
        </Button>
      </form>

      {isError && <Alert tone="danger">Không tải được danh sách phản hồi</Alert>}
      {isPending && <p className="text-center text-stone-700">Đang tải…</p>}
      {data?.items.length === 0 && (
        <p className="rounded-lg border border-stone-300 bg-white p-6 text-center text-stone-700">
          {query.search || query.rating || query.replied
            ? 'Không có phản hồi phù hợp'
            : 'Chưa có phản hồi nào'}
        </p>
      )}
      <div className="space-y-4">
        {data?.items.map((item) => (
          <FeedbackCard
            key={item.id}
            item={item}
            canReply={me?.role === Role.Receptionist}
            pending={reply.isPending && replyingId === item.id}
            error={
              reply.isError && replyingId === item.id ? getErrorMessage(reply.error) : undefined
            }
            onReply={(content) => {
              setReplyingId(item.id)
              reply.mutate({ id: item.id, content })
            }}
          />
        ))}
      </div>

      {data && data.total > data.limit && (
        <nav aria-label="Phân trang" className="flex items-center justify-end gap-3 text-sm">
          <Button
            variant="secondary"
            size="sm"
            disabled={query.page <= 1}
            onClick={() => setQuery((q) => ({ ...q, page: q.page - 1 }))}
          >
            Trước
          </Button>
          <span>
            Trang {query.page} / {totalPages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={query.page >= totalPages}
            onClick={() => setQuery((q) => ({ ...q, page: q.page + 1 }))}
          >
            Sau
          </Button>
        </nav>
      )}
    </section>
  )
}
