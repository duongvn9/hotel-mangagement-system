import { Bell } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/atoms'
import { EmptyState } from '@/components/molecules'
import { PageContainer, PageHeader } from '@/components/organisms'
import { useAuth } from '@/features/auth/auth-context'
import { fdate } from '@/lib/format'
import { cn } from '@/lib/utils'
import { notificationsFor } from '../mock'

/** Hộp thông báo dùng dữ liệu mẫu; trạng thái đã đọc chỉ nằm trong trang này. */
export function NotificationsPage() {
  const { me } = useAuth()
  const list = notificationsFor(me?.role ?? '')
  const [readIds, setReadIds] = useState<string[]>([])
  const isRead = (id: string, read: boolean) => read || readIds.includes(id)

  return (
    <PageContainer>
      <PageHeader
        eyebrow={
          <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold tracking-wider text-info uppercase">
            Đề xuất UX
          </span>
        }
        title="Thông báo"
        subtitle="Hộp thư chung cho các cảnh báo mà hệ thống đang gửi."
        actions={
          <Button
            variant="outline"
            className="rounded-full"
            onClick={() => setReadIds(list.map((item) => item.id))}
          >
            Đánh dấu tất cả đã đọc
          </Button>
        }
      />
      {list.length === 0 ? (
        <EmptyState icon={Bell} title="Bạn đã xem hết thông báo" />
      ) : (
        <div className="card-soft divide-y">
          {list.map((item) => {
            const read = isRead(item.id, item.read)
            return (
              <button
                key={item.id}
                type="button"
                data-read={read ? 'true' : undefined}
                onClick={() => setReadIds((ids) => [...ids, item.id])}
                className="flex w-full items-start gap-4 p-5 text-left hover:bg-surface/50"
              >
                <span
                  className={cn('mt-1.5 size-2 rounded-full', read ? 'bg-border' : 'bg-primary')}
                />
                <div className="flex-1">
                  <div className={cn('text-sm', !read && 'font-semibold')}>{item.title}</div>
                  <div className="text-sm text-muted-foreground">{item.body}</div>
                </div>
                <span className="text-xs text-muted-foreground">{fdate(item.date)}</span>
              </button>
            )
          })}
        </div>
      )}
    </PageContainer>
  )
}
