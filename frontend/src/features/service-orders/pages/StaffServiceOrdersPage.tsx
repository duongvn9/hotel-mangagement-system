import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { Badge, Button, Input, NativeSelect } from '@/components/atoms'
import { EmptyState, FormField } from '@/components/molecules'
import { DataTable, PageContainer, PageHeader } from '@/components/organisms'
import {
  dateTime,
  money,
  reviewLabels,
  reviewStatuses,
  serviceOrderState,
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
                executionStatus: (event.target.value || undefined) as OrderQuery['executionStatus'],
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
      {!orders.isError && orders.isFetching && (
        <p role="status" className="text-sm text-muted-foreground">
          Đang tải yêu cầu dịch vụ…
        </p>
      )}
      {orders.isError && (
        <StaffOrderError
          error={orders.error}
          retry={() => void orders.refetch()}
          presentation="workspace"
        />
      )}
      {!orders.isError && (
        <DataTable
          rows={orders.data?.items ?? []}
          loading={orders.isPending || orders.isFetching}
          caption="Yêu cầu dịch vụ"
          scrollLabel="Danh sách yêu cầu dịch vụ"
          empty={
            <div role="status">
              <EmptyState title="Không có yêu cầu dịch vụ phù hợp." />
            </div>
          }
          page={orders.data?.page ?? query.page}
          totalPages={Math.min(
            10000,
            Math.max(1, Math.ceil((orders.data?.total ?? 0) / (orders.data?.limit ?? query.limit))),
          )}
          onPageChange={(page) => setQuery({ ...query, page })}
          paginationDisabled={orders.isFetching}
          paginationSummary={`Trang ${orders.data?.page ?? query.page} · ${orders.data?.total ?? 0} yêu cầu`}
          toolbarStart={
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
          }
          columns={[
            {
              key: 'service',
              header: 'Dịch vụ',
              rowHeader: true,
              className: 'min-w-48 max-w-80 whitespace-normal break-words',
              render: (order) => (
                <div className="space-y-2">
                  <Link
                    className="inline-flex min-h-11 items-center rounded-sm font-medium text-primary underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    to={`/staff/service-orders/${encodeURIComponent(order.id)}`}
                  >
                    {order.service.name}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {order.quantity} {order.service.unit} ·{' '}
                    {order.feeRequired ? money(order.amount) : 'Không tính phí'}
                  </p>
                  <p className="text-xs text-muted-foreground">{billingLabel(order)}</p>
                </div>
              ),
            },
            {
              key: 'review',
              header: 'Trạng thái duyệt',
              render: (order) => (
                <div className="space-y-2">
                  <Badge
                    tone={
                      order.reviewStatus === 'ACCEPTED'
                        ? 'success'
                        : order.reviewStatus === 'PENDING_REVIEW' ||
                            order.reviewStatus === 'ACCEPTING'
                          ? 'warning'
                          : order.reviewStatus === 'REJECTED'
                            ? 'danger'
                            : 'neutral'
                    }
                    className="h-auto whitespace-normal"
                  >
                    {reviewLabels[order.reviewStatus] ?? 'Chưa xác định'}
                  </Badge>
                  {serviceOrderState(order).state === 'UNKNOWN' && (
                    <OrderBusinessState order={order} />
                  )}
                </div>
              ),
            },
            {
              key: 'booking',
              header: 'Khách và đặt phòng',
              className: 'min-w-48 max-w-64 whitespace-normal break-words',
              render: (order) => (
                <div className="space-y-1">
                  <p>{order.customer.fullName?.trim() || 'Chưa có tên khách hàng'}</p>
                  <p className="text-xs text-muted-foreground">
                    Đặt phòng: {order.booking?.code ?? 'Không còn thông tin đặt phòng'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Phòng: {order.booking?.roomNumbers?.join(', ') || '—'}
                  </p>
                </div>
              ),
            },
            {
              key: 'execution',
              header: 'Thực hiện',
              className: 'min-w-48 whitespace-normal',
              render: (order) => (
                <div className="space-y-2">
                  <Badge
                    tone={
                      order.executionStatus === 'COMPLETED'
                        ? 'success'
                        : order.executionStatus === 'ASSIGNING'
                          ? 'warning'
                          : order.executionStatus === 'ASSIGNED' ||
                              order.executionStatus === 'IN_PROGRESS'
                            ? 'info'
                            : 'neutral'
                    }
                  >
                    {executionLabels[order.executionStatus] ?? 'Chưa xác định'}
                  </Badge>
                  {order.intakeMode === 'COMPLETED_ON_SITE' ? (
                    <p className="text-xs text-muted-foreground">
                      Đã thực hiện tại chỗ · Không tạo công việc phân công
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {order.task
                        ? order.task.assigneeName?.trim() || 'Chưa có tên nhân viên'
                        : 'Chưa phân công'}
                    </p>
                  )}
                </div>
              ),
            },
            {
              key: 'time',
              header: 'Thời gian',
              className: 'min-w-48 whitespace-normal',
              render: (order) => (
                <div className="space-y-2 text-xs text-muted-foreground">
                  <p>Thời điểm ghi nhận: {dateTime(order.createdAt)}</p>
                  {order.intakeMode === 'COMPLETED_ON_SITE' ? (
                    <p>
                      Thời điểm hoàn thành thực tế:{' '}
                      {order.actualCompletedAt
                        ? dateTime(order.actualCompletedAt)
                        : 'Chưa có thông tin'}
                    </p>
                  ) : (
                    <p>Thời gian yêu cầu: {dateTime(order.requestedTime)}</p>
                  )}
                </div>
              ),
            },
          ]}
        />
      )}
    </PageContainer>
  )
}
