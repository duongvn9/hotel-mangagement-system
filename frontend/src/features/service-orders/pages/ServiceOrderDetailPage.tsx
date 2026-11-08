import { useParams } from 'react-router'
import { Skeleton } from '@/components/atoms'
import { PageContainer, PageHeader } from '@/components/organisms'
import { useOrder } from '../hooks'
import { OrderError, OrderNavigation, OrderReceipt } from '../presentation'

export function ServiceOrderDetailPage() {
  const { id = '' } = useParams()
  const order = useOrder(id)
  return (
    <PageContainer>
      <OrderNavigation />
      <PageHeader title="Chi tiết yêu cầu dịch vụ" />
      {order.isPending && (
        <div role="status" className="space-y-4">
          <p className="text-sm text-muted-foreground">Đang tải yêu cầu dịch vụ…</p>
          <Skeleton className="h-64 w-full" />
        </div>
      )}
      {order.isError && (
        <OrderError
          error={order.error}
          retry={() => void order.refetch()}
          presentation="workspace"
        />
      )}
      {order.isSuccess && <OrderReceipt order={order.data} presentation="workspace" />}
    </PageContainer>
  )
}
