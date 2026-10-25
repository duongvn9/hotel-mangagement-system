import type { ReactNode } from 'react'
import { Alert } from '@/components/Alert'
import { Button } from '@/components/Button'
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
    <section
      aria-labelledby={id}
      className="min-w-0 space-y-4 rounded border border-stone-300 bg-white p-5"
    >
      <h3 id={id} className="text-lg font-semibold">
        {title}
      </h3>
      {!block ? (
        <p role="status">Đang tải…</p>
      ) : block.available ? (
        children(block)
      ) : block.reason === 'not_available' ? (
        <p className="text-sm text-stone-700">Chưa có dữ liệu nguồn</p>
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
