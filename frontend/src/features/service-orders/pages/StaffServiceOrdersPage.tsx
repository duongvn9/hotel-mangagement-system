import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/Button'
import { SelectField } from '@/components/SelectField'
import { TextField } from '@/components/TextField'
import {
  dateTime,
  money,
  reviewLabels,
  reviewStatuses,
  executionLabels,
  executionStatuses,
  type OrderQuery,
} from '../api'
import { useStaffOrders } from '../staff-hooks'
import { billingLabel } from '../staff-api'
import { StaffOrderError } from '../staff-presentation'
import { OrderBusinessState } from '../presentation'

export function StaffServiceOrdersPage() {
  const [query, setQuery] = useState<OrderQuery>({
    page: 1,
    limit: 20,
    reviewStatus: 'PENDING_REVIEW',
  })
  const [keyword, setKeyword] = useState('')
  const orders = useStaffOrders(query)
  function search(event: FormEvent) {
    event.preventDefault()
    setQuery({ ...query, keyword: keyword.trim(), page: 1 })
  }
  return (
    <section className="mx-auto max-w-container px-4 py-8">
      <h1 className="mb-6 font-display text-3xl">Yêu cầu dịch vụ</h1>
      <form onSubmit={search} className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <TextField
          label="Từ khóa dịch vụ"
          maxLength={100}
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
        />
        <SelectField
          label="Trạng thái duyệt"
          value={query.reviewStatus}
          options={reviewStatuses.map((value) => ({ value, label: reviewLabels[value] }))}
          onChange={(event) =>
            setQuery({
              ...query,
              page: 1,
              reviewStatus: event.target.value as OrderQuery['reviewStatus'],
            })
          }
        />
        <SelectField
          label="Trạng thái thực hiện"
          value={query.executionStatus ?? ''}
          options={[
            { value: '', label: 'Tất cả' },
            ...executionStatuses.map((value) => ({ value, label: executionLabels[value] })),
          ]}
          onChange={(event) =>
            setQuery({
              ...query,
              page: 1,
              executionStatus: (event.target.value || undefined) as OrderQuery['executionStatus'],
            })
          }
        />
        <Button type="submit" className="self-end">
          Tìm kiếm
        </Button>
      </form>
      {orders.isPending && <p role="status">Đang tải yêu cầu dịch vụ…</p>}
      {orders.isError && (
        <StaffOrderError error={orders.error} retry={() => void orders.refetch()} />
      )}
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
                  <h2 className="font-display text-2xl">
                    <Link
                      className="inline-flex min-h-11 items-center text-primary underline"
                      to={`/staff/service-orders/${encodeURIComponent(order.id)}`}
                    >
                      {order.service.name}
                    </Link>
                  </h2>
                  <p>
                    Khách hàng: {order.customer.fullName ?? 'Không có tên'} · {order.customer.id}
                  </p>
                  <p>Đặt phòng: {order.booking?.code ?? 'Không còn thông tin đặt phòng'}</p>
                  <p>
                    {order.quantity} {order.service.unit} · {money(order.amount)}
                  </p>
                  <OrderBusinessState order={order} />
                  <p>{billingLabel(order)}</p>
                  <p>Thời gian yêu cầu: {dateTime(order.requestedTime)}</p>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <SelectField
              label="Số yêu cầu mỗi trang"
              value={String(query.limit)}
              options={[10, 20, 50, 100].map((value) => ({
                value: String(value),
                label: String(value),
              }))}
              onChange={(event) =>
                setQuery({ ...query, page: 1, limit: Number(event.target.value) })
              }
            />
            <Button
              variant="secondary"
              disabled={orders.data.page <= 1 || orders.isFetching}
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
                orders.data.page * orders.data.limit >= orders.data.total ||
                query.page >= 10000 ||
                orders.isFetching
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
