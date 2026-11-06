import type { ReactNode } from 'react'
import { Alert } from '@/components/molecules'
import { Button } from '@/components/atoms'
import type { DashboardBlock } from '../api'

export function DashboardCard<T>({
  id,
  title,
  block,
  loading,
  retry,
  children,
}: {
  id: string
  title: string
  block?: DashboardBlock<T>
  loading: boolean
  retry: () => void
  children: (value: T) => ReactNode
}) {
  return (
    <section aria-labelledby={id} className="card-soft min-w-0 space-y-4 p-5">
      <h3 id={id} className="text-lg font-semibold text-foreground">
        {title}
      </h3>
      {!block ? (
        <p role="status" className="text-sm text-muted-foreground">
          Đang tải…
        </p>
      ) : block.available ? (
        children(block)
      ) : block.reason === 'not_available' ? (
        <p className="text-sm text-muted-foreground">Chưa có dữ liệu nguồn</p>
      ) : (
        <>
          <Alert tone="danger">Không tải được số liệu. Các khối khác vẫn có thể xem.</Alert>
          <Button type="button" variant="secondary" disabled={loading} onClick={retry}>
            Thử lại
          </Button>
        </>
      )}
    </section>
  )
}
