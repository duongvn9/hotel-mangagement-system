import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Input, NativeSelect } from '@/components/atoms'
import { EmptyState, StatCard } from '@/components/molecules'
import { PageContainer, PageHeader, Pager } from '@/components/organisms'
import { Role } from '@/features/auth/api'
import { useAuth } from '@/features/auth/auth-context'
import { getErrorMessage } from '@/lib/api-client'
import { cn } from '@/lib/utils'
import { listFeedback, replyFeedback, type FeedbackQuery } from '../api'
import { FeedbackCard } from '../FeedbackCard'

const LIMIT = 10
const RATINGS = [0, 5, 4, 3, 2, 1]

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
  // Thẻ số liệu: API không có điểm trung bình, nên đếm tổng và số chờ phản hồi.
  const totalAll = useQuery({
    queryKey: ['feedback-count', 'all'],
    queryFn: () => listFeedback({ page: 1, limit: 1 }),
  })
  const totalUnreplied = useQuery({
    queryKey: ['feedback-count', 'unreplied'],
    queryFn: () => listFeedback({ replied: 'false', page: 1, limit: 1 }),
  })

  const reply = useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) => replyFeedback(id, content),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['feedback'] })
      void queryClient.invalidateQueries({ queryKey: ['feedback-count'] })
    },
  })

  const filter = (patch: Partial<FeedbackQuery>) => setQuery((q) => ({ ...q, ...patch, page: 1 }))
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1
  const activeRating = query.rating ?? 0

  function onSearch(event: FormEvent) {
    event.preventDefault()
    filter({ search: search.trim() || undefined })
  }

  return (
    <PageContainer>
      <PageHeader
        title="Đánh giá của khách"
        subtitle="Phản hồi đánh giá và phát hiện vấn đề lặp lại."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <StatCard label="Đánh giá" value={totalAll.data?.total ?? '—'} />
        <StatCard label="Chờ phản hồi" value={totalUnreplied.data?.total ?? '—'} />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {RATINGS.map((n) => (
          <button
            key={n}
            type="button"
            aria-pressed={activeRating === n}
            onClick={() => filter({ rating: n || undefined })}
            className={cn(
              'rounded-full border px-3 py-1.5 text-sm',
              activeRating === n ? 'border-ink bg-ink text-ink-foreground' : 'bg-card',
            )}
          >
            {n ? `${n}★` : 'Tất cả'}
          </button>
        ))}
      </div>

      <form onSubmit={onSearch} className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative sm:w-72">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            aria-label="Tìm kiếm"
            placeholder="Nội dung, tên hoặc email khách"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 rounded-full bg-surface/60 pl-9"
          />
        </div>
        <div className="sm:w-44">
          <NativeSelect
            aria-label="Trạng thái"
            className="h-9 rounded-full"
            value={query.replied ?? ''}
            onChange={(e) =>
              filter({ replied: (e.target.value || undefined) as FeedbackQuery['replied'] })
            }
          >
            <option value="">Tất cả</option>
            <option value="false">Chưa trả lời</option>
            <option value="true">Đã trả lời</option>
          </NativeSelect>
        </div>
      </form>

      {isError && (
        <p
          role="alert"
          className="mb-4 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          Không tải được danh sách phản hồi
        </p>
      )}

      {!isPending && data?.items.length === 0 ? (
        <EmptyState
          title={
            query.search || query.rating || query.replied
              ? 'Không có phản hồi phù hợp'
              : 'Chưa có phản hồi nào'
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
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
      )}

      {data && data.total > data.limit && (
        <nav
          aria-label="Phân trang"
          className="mt-6 flex justify-end text-xs text-muted-foreground"
        >
          <Pager
            page={query.page}
            totalPages={totalPages}
            onPrev={() => setQuery((q) => ({ ...q, page: q.page - 1 }))}
            onNext={() => setQuery((q) => ({ ...q, page: q.page + 1 }))}
          />
        </nav>
      )}
    </PageContainer>
  )
}
