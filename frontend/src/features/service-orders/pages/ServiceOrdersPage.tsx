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
import { useOrders } from '../hooks'
import { OrderBusinessState, OrderError, OrderNavigation } from '../presentation'

export function ServiceOrdersPage() {
  const [query, setQuery] = useState<OrderQuery>({ page: 1, limit: 20 })
  const [keyword, setKeyword] = useState('')
  const orders = useOrders(query)
  function search(event: FormEvent) {
    event.preventDefault()
    setQuery({ ...query, keyword, page: 1 })
  }
  return (
    <PageContainer>
      <OrderNavigation />
      <PageHeader title="Dịch vụ của tôi" />
      <Panel title="Lịch sử đặt dịch vụ">
        <form onSubmit={search} className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FormField label="Từ khóa" htmlFor="order-keyword">
            <Input
              id="order-keyword"
              maxLength={100}
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
            />
          </FormField>
          <FormField label="Trạng thái duyệt" htmlFor="order-review-status">
            <NativeSelect
              id="order-review-status"
              value={query.reviewStatus ?? ''}
              onChange={(event) =>
                setQuery({
                  ...query,
                  page: 1,
                  reviewStatus: (event.target.value || undefined) as OrderQuery['reviewStatus'],
                })
              }
            >
              <option value="">Tất cả</option>
              {reviewStatuses.map((value) => (
                <option key={value} value={value}>
                  {reviewLabels[value]}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField label="Trạng thái thực hiện" htmlFor="order-execution-status">
            <NativeSelect
              id="order-execution-status"
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
          <OrderError
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
                        to={`/customer/service-orders/${encodeURIComponent(order.id)}`}
                        className="inline-flex min-h-11 items-center rounded-sm text-primary underline transition-colors hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {order.service.name}
                      </Link>
                    </h2>
                    <p>
                      {order.quantity} {order.service.unit} · {money(order.amount)}
                    </p>
                    <OrderBusinessState order={order} />
                    {order.reviewStatus === 'REJECTED' && (
                      <p className="text-sm break-words whitespace-pre-wrap text-muted-foreground">
                        Lý do từ chối: {order.reviewReason?.trim() || 'Không có lý do từ chối.'}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Tạo lúc: {dateTime(order.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-6 flex flex-wrap items-center gap-4">
              <Button
                variant="outline"
                className="rounded-full"
                disabled={orders.data.page <= 1}
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
                  orders.data.page * orders.data.limit >= orders.data.total || query.page >= 10000
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
