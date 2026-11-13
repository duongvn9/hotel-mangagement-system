import { useState, type FormEvent } from 'react'
import { isAxiosError } from 'axios'
import { Link, useParams } from 'react-router'
import { Button, Input, NativeSelect, Skeleton } from '@/components/atoms'
import { Alert, EmptyState, FormField } from '@/components/molecules'
import { PageContainer, PageHeader, Panel } from '@/components/organisms'
import { dateTime } from '../api'
import {
  useServiceHistory,
  useServiceHistoryDetail,
  type HistoryQuery,
  type ServiceHistory,
} from '../history'

const linkClass =
  'inline-flex min-h-11 items-center rounded-sm text-primary underline transition-colors hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
function HistoryError({ error, retry }: { error: unknown; retry: () => void }) {
  const status = isAxiosError(error) ? error.response?.status : undefined
  return (
    <Alert tone="danger" className="space-y-3">
      <p>
        {status === 404
          ? 'Không tìm thấy lịch sử hoặc dữ liệu không thuộc tài khoản của bạn.'
          : status === 403
            ? 'Bạn không có quyền xem lịch sử dịch vụ.'
            : 'Không thể tải lịch sử dịch vụ. Vui lòng thử lại.'}
      </p>
      <Button variant="outline" className="rounded-full" onClick={retry}>
        Thử lại
      </Button>
    </Alert>
  )
}
function HistoryResult({ order }: { order: ServiceHistory }) {
  return (
    <Panel className="min-w-0 break-words">
      <div className="space-y-3 text-sm">
        <p>Dịch vụ: {order.service.name}</p>
        <p>
          Số lượng: {order.quantity} {order.service.unit}
        </p>
        <p>Thời gian yêu cầu: {dateTime(order.requestedTime)}</p>
        {order.task && <p>Đã giao: {dateTime(order.task.assignedAt)}</p>}
        {order.task?.dueAt && <p>Hạn hoàn thành: {dateTime(order.task.dueAt)}</p>}
        <p>Hoàn thành: {dateTime(order.actualCompletedAt ?? order.task?.completedAt ?? '')}</p>
        {order.actualPerformerId && <p>Người thực hiện thực tế: {order.actualPerformerId}</p>}
        <h2 className="text-sm font-semibold">Kết quả thực hiện</h2>
        <p className="whitespace-pre-wrap">
          {order.completionDetails || order.task?.workResult || 'Không có kết quả ghi nhận.'}
        </p>
        {order.task && (
          <Link className={linkClass} to={`/staff/tasks/${encodeURIComponent(order.task.id)}`}>
            Xem công việc nguồn của tôi
          </Link>
        )}
      </div>
    </Panel>
  )
}
export function ServiceHistoryPage() {
  const [query, setQuery] = useState<HistoryQuery>({ page: 1, limit: 20 })
  const [keyword, setKeyword] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [validation, setValidation] = useState('')
  const history = useServiceHistory(query)
  function search(event: FormEvent) {
    event.preventDefault()
    if (keyword.trim().length > 100) {
      setValidation('Từ khóa dịch vụ tối đa 100 ký tự.')
      return
    }
    const start = from ? new Date(`${from}T00:00:00`) : undefined
    const end = to ? new Date(`${to}T23:59:59.999`) : undefined
    if (
      (start && !Number.isFinite(start.getTime())) ||
      (end && !Number.isFinite(end.getTime())) ||
      (start && end && start > end)
    ) {
      setValidation('Khoảng ngày hoàn thành không hợp lệ.')
      return
    }
    setValidation('')
    setQuery({
      page: 1,
      limit: query.limit,
      ...(keyword.trim() ? { keyword: keyword.trim() } : {}),
      ...(start ? { from: start.toISOString() } : {}),
      ...(end ? { to: end.toISOString() } : {}),
    })
  }
  return (
    <PageContainer>
      <PageHeader
        title="Lịch sử thực hiện dịch vụ"
        subtitle="Chỉ xem dịch vụ bạn đã hoàn thành. Lọc theo ngày hoàn thành, bao gồm cả ngày đầu và ngày cuối theo giờ địa phương."
        actions={
          <Button asChild variant="outline" className="rounded-full">
            <Link to="/staff/service/dashboard">Bảng điều khiển dịch vụ</Link>
          </Button>
        }
      />
      <div className="mb-6 flex flex-wrap gap-3">
        <Button asChild className="rounded-full">
          <Link to="/staff/service-history/intake">Ghi nhận yêu cầu</Link>
        </Button>
        <Button asChild variant="outline" className="rounded-full">
          <Link to="/staff/service-history/reports">Yêu cầu tôi ghi nhận</Link>
        </Button>
      </div>
      <Panel>
        <form onSubmit={search} className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FormField label="Từ khóa dịch vụ" htmlFor="history-keyword">
            <Input
              id="history-keyword"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              maxLength={100}
            />
          </FormField>
          <FormField label="Hoàn thành từ ngày" htmlFor="history-from">
            <Input
              id="history-from"
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
            />
          </FormField>
          <FormField label="Hoàn thành đến ngày" htmlFor="history-to">
            <Input
              id="history-to"
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
            />
          </FormField>
          <FormField label="Số kết quả mỗi trang" htmlFor="history-limit">
            <NativeSelect
              id="history-limit"
              value={query.limit}
              onChange={(event) =>
                setQuery({ ...query, page: 1, limit: Number(event.target.value) })
              }
            >
              {[10, 20, 50].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          {validation && (
            <Alert tone="danger" className="sm:col-span-2 lg:col-span-4">
              {validation}
            </Alert>
          )}
          <Button type="submit" className="rounded-full" disabled={history.isFetching}>
            Tìm kiếm
          </Button>
        </form>
        <Button
          variant="outline"
          className="mb-4 rounded-full"
          disabled={history.isFetching}
          onClick={() => void history.refetch()}
        >
          Tải lại lịch sử
        </Button>
        {history.isFetching && (
          <div role="status" className="space-y-3">
            <p className="text-sm text-muted-foreground">Đang tải lịch sử dịch vụ…</p>
            <Skeleton className="h-24 w-full" />
          </div>
        )}
        {history.isError ? (
          <HistoryError error={history.error} retry={() => void history.refetch()} />
        ) : (
          history.data && (
            <>
              {history.data.items.length === 0 ? (
                <EmptyState title="Không có lịch sử dịch vụ phù hợp." />
              ) : (
                <ul className="divide-y divide-border">
                  {history.data.items.map((order) => (
                    <li key={order.id} className="min-w-0 space-y-2 py-3 text-sm break-words">
                      <Link
                        className={linkClass}
                        to={`/staff/service-history/${encodeURIComponent(order.id)}`}
                      >
                        {order.service.name}
                      </Link>
                      <p>
                        Hoàn thành:{' '}
                        {dateTime(order.actualCompletedAt ?? order.task?.completedAt ?? '')}
                      </p>
                      <p className="whitespace-pre-wrap">
                        {order.completionDetails || order.task?.workResult}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-6 flex flex-wrap items-center gap-4 text-sm">
                <Button
                  variant="outline"
                  className="rounded-full"
                  disabled={history.isFetching || query.page <= 1}
                  onClick={() => setQuery({ ...query, page: query.page - 1 })}
                >
                  Trang trước
                </Button>
                <p>
                  Trang {history.data.page} · {history.data.total} kết quả
                </p>
                <Button
                  variant="outline"
                  className="rounded-full"
                  disabled={history.isFetching || query.page * query.limit >= history.data.total}
                  onClick={() => setQuery({ ...query, page: query.page + 1 })}
                >
                  Trang sau
                </Button>
              </div>
            </>
          )
        )}
      </Panel>
    </PageContainer>
  )
}
export function ServiceHistoryDetailPage() {
  const { id = '' } = useParams()
  const history = useServiceHistoryDetail(id)
  return (
    <PageContainer>
      <PageHeader
        title="Chi tiết lịch sử dịch vụ"
        subtitle="Chỉ xem kết quả đã hoàn thành."
        actions={
          <Button asChild variant="outline" className="rounded-full">
            <Link to="/staff/service-history">Quay lại lịch sử dịch vụ</Link>
          </Button>
        }
      />
      {history.isPending && (
        <div role="status" className="space-y-3">
          <p className="text-sm text-muted-foreground">Đang tải lịch sử dịch vụ…</p>
          <Skeleton className="h-48 w-full" />
        </div>
      )}
      {history.isError ? (
        <HistoryError error={history.error} retry={() => void history.refetch()} />
      ) : (
        history.data && <HistoryResult order={history.data} />
      )}
    </PageContainer>
  )
}
