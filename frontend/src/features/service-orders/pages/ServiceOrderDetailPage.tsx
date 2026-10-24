import { useParams } from 'react-router'
import { useOrder } from '../hooks'
import { OrderError, OrderNavigation, OrderReceipt } from '../presentation'

export function ServiceOrderDetailPage() {
  const { id = '' } = useParams()
  const order = useOrder(id)
  return (
    <section className="mx-auto max-w-container px-4 py-8">
      <OrderNavigation />
      <h1 className="mb-6 font-display text-3xl">Chi tiết yêu cầu dịch vụ</h1>
      {order.isPending && <p role="status">Đang tải yêu cầu dịch vụ…</p>}
      {order.isError && <OrderError error={order.error} retry={() => void order.refetch()} />}
      {order.isSuccess && <OrderReceipt order={order.data} />}
    </section>
  )
}
