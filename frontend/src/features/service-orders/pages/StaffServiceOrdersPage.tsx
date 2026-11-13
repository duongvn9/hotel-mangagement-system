import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { Button, Input, NativeSelect, Skeleton } from '@/components/atoms'
import { EmptyState, FormField } from '@/components/molecules'
import { PageContainer, PageHeader, Panel } from '@/components/organisms'
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
    <PageContainer>
      <PageHeader
        title="Yêu cầu dịch vụ"
        subtitle="Nhận, giao và hoàn tất yêu cầu của khách."
        actions={
          <Button asChild className="rounded-full">
            <Link to="/staff/service-orders/intake">Ghi nhận yêu cầu</Link>
          </Button>
        }
      />
      <Panel>
        <form onSubmit={search} className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FormField label="Từ khóa dịch vụ" htmlFor="staff-order-keyword">
            <Input
              id="staff-order-keyword"
              maxLength={100}
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
            />
          </FormField>
          <FormField label="Trạng thái duyệt" htmlFor="staff-order-review">
            <NativeSelect
              id="staff-order-review"
              value={query.reviewStatus}
              onChange={(event) =>
                setQuery({
                  ...query,
                  page: 1,
                  reviewStatus: event.target.value as OrderQuery['reviewStatus'],
                })
              }
            >
              {reviewStatuses.map((value) => (
                <option key={value} value={value}>
                  {reviewLabels[value]}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField label="Trạng thái thực hiện" htmlFor="staff-order-execution">
            <NativeSelect
              id="staff-order-execution"
              value={query.executionStatus ?? ''}
              onChange={(event) =>
                setQuery({
                  ...query,
                  page: 1,
                  executionStatus: (event.target.value ||
                    undefined) as OrderQuery['executionStatus'],
                })
              }
            >
              <option value="">Tất cả</option>
              {executionStatuses.map((value) => (
                <option key={value} value={value}>
                  {executionLabels[value]}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <Button type="submit" className="self-end rounded-full">
            Tìm kiếm
          </Button>
        </form>
        {orders.isPending && (
          <div role="status" className="space-y-3">
            <p className="text-sm text-muted-foreground">Đang tải yêu cầu dịch vụ…</p>
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        )}
        {orders.isError && (
          <StaffOrderError
            error={orders.error}
            retry={() => void orders.refetch()}
            presentation="workspace"
          />
        )}
        {orders.isSuccess && (
          <>
            {!orders.data.items.length ? (
              <div role="status">
                <EmptyState title="Không có yêu cầu dịch vụ phù hợp." />
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {orders.data.items.map((order) => (
                  <li key={order.id} className="min-w-0 space-y-2 py-3 text-sm break-words">
                    <h2 className="font-medium">
                      <Link
                        className="inline-flex min-h-11 items-center rounded-sm text-primary underline transition-colors hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        to={`/staff/service-orders/${encodeURIComponent(order.id)}`}
                      >
                        {order.service.name}
                      </Link>
                    </h2>
                    <p>Khách hàng: {order.customer.fullName?.trim() || 'Chưa có tên khách hàng'}</p>
                    <p>Đặt phòng: {order.booking?.code ?? 'Không còn thông tin đặt phòng'}</p>
                    <p>Phòng: {order.booking?.roomNumbers?.join(', ') || '—'}</p>
                    <p>
                      {order.quantity} {order.service.unit} · {money(order.amount)}
                    </p>
                    <OrderBusinessState order={order} />
                    <p>{billingLabel(order)}</p>
                    <p className="text-xs text-muted-foreground">
                      Thời gian yêu cầu: {dateTime(order.requestedTime)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-6 flex flex-wrap items-center gap-4">
              <FormField label="Số yêu cầu mỗi trang" htmlFor="staff-order-limit">
                <NativeSelect
                  id="staff-order-limit"
                  value={String(query.limit)}
                  onChange={(event) =>
                    setQuery({ ...query, page: 1, limit: Number(event.target.value) })
                  }
                >
                  {[10, 20, 50, 100].map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </NativeSelect>
              </FormField>
              <Button
                variant="outline"
                className="rounded-full"
                disabled={orders.data.page <= 1 || orders.isFetching}
                onClick={() => setQuery({ ...query, page: query.page - 1 })}
              >
                Trang trước
              </Button>
              <span>
                Trang {orders.data.page} · {orders.data.total} yêu cầu
              </span>
              <Button
                variant="outline"
                className="rounded-full"
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
      </Panel>
    </PageContainer>
  )
}
