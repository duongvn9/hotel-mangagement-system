import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { TextField } from '@/components/TextField'
import { SelectField } from '@/components/SelectField'
import { Button } from '@/components/Button'
import { dateTime, money, reviewLabels, type OrderQuery } from '../api'
import { useOrders } from '../hooks'
import { OrderError, OrderNavigation } from '../presentation'

export function ServiceOrdersPage() {
  const [query, setQuery] = useState<OrderQuery>({ page: 1, limit: 20 })
  const [keyword, setKeyword] = useState('')
  const orders = useOrders(query)
  function search(event: FormEvent) {
    event.preventDefault()
    setQuery({ ...query, keyword, page: 1 })
  }
  return (
    <section className="mx-auto max-w-container px-4 py-8">
      <OrderNavigation />
      <h1 className="mb-6 font-display text-3xl">Dịch vụ của tôi</h1>
      <form onSubmit={search} className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <TextField
          label="Từ khóa"
          maxLength={100}
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
        />
        <SelectField
          label="Trạng thái duyệt"
          value={query.reviewStatus ?? ''}
          onChange={(event) =>
            setQuery({
              ...query,
              page: 1,
              reviewStatus: event.target.value === 'PENDING_REVIEW' ? 'PENDING_REVIEW' : undefined,
            })
          }
          options={[
            { value: '', label: 'Tất cả' },
            { value: 'PENDING_REVIEW', label: 'Chờ duyệt' },
          ]}
        />
        <SelectField
          label="Trạng thái thực hiện"
          value={query.executionStatus ?? ''}
          onChange={(event) =>
            setQuery({
              ...query,
              page: 1,
              executionStatus: event.target.value === 'NOT_STARTED' ? 'NOT_STARTED' : undefined,
            })
          }
          options={[
            { value: '', label: 'Tất cả' },
            { value: 'NOT_STARTED', label: 'Chưa bắt đầu' },
          ]}
        />
        <Button type="submit" className="self-end">
          Tìm kiếm
        </Button>
      </form>
      {orders.isPending && <p role="status">Đang tải yêu cầu dịch vụ…</p>}
      {orders.isError && <OrderError error={orders.error} retry={() => void orders.refetch()} />}
      {orders.isSuccess && (
        <>
          {!orders.data.items.length ? (
            <p role="status">Không có yêu cầu dịch vụ phù hợp.</p>
          ) : (
            <ul className="grid gap-4 md:grid-cols-2">
              {orders.data.items.map((order) => (
                <li
                  key={order.id}
                  className="min-w-0 space-y-2 rounded border border-stone-300 bg-white p-4 break-words"
                >
                  <h2 className="font-display text-xl">
                    <Link
                      to={`/customer/service-orders/${encodeURIComponent(order.id)}`}
                      className="inline-flex min-h-11 items-center text-primary underline"
                    >
                      {order.service.name}
                    </Link>
                  </h2>
                  <p>
                    {order.quantity} {order.service.unit} · {money(order.amount)}
                  </p>
                  <p>{reviewLabels[order.reviewStatus]} · Chưa bắt đầu</p>
                  <p className="text-sm text-stone-700">Tạo lúc: {dateTime(order.createdAt)}</p>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <Button
              variant="secondary"
              disabled={orders.data.page <= 1}
              onClick={() => setQuery({ ...query, page: query.page - 1 })}
            >
              Trang trước
            </Button>
            <span>
              Trang {orders.data.page} · {orders.data.total} yêu cầu
            </span>
            <Button
              variant="secondary"
              disabled={
                orders.data.page * orders.data.limit >= orders.data.total || query.page >= 10000
              }
              onClick={() => setQuery({ ...query, page: query.page + 1 })}
            >
              Trang sau
            </Button>
          </div>
        </>
      )}
    </section>
  )
}
