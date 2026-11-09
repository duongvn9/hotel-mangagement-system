import { useEffect, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { Badge, Button, Input, NativeSelect } from '@/components/atoms'
import { Alert, EmptyState, FormField } from '@/components/molecules'
import { DataTable, PageContainer, PageHeader, Panel } from '@/components/organisms'
import { useAuth } from '@/features/auth/auth-context'
import { getErrorMessage } from '@/lib/api-client'
import { listMaintenanceHistory, type HistoryQuery } from '../api'
import { HistoryStatusBadge, HistoryTarget } from '../components/HistoryPresentation'
import { displayHistoryDay, parseHistoryDay, historyDate, HISTORY_LABELS } from '../history'

export function MaintenanceHistoryPage() {
  const { me } = useAuth()
  const [params, setParams] = useSearchParams()
  const location = useLocation()
  const [search, setSearch] = useState(params.get('q') ?? '')
  const [from, setFrom] = useState(displayHistoryDay(params.get('from') ?? ''))
  const [to, setTo] = useState(displayHistoryDay(params.get('to') ?? ''))
  const parsedFrom = parseHistoryDay(from)
  const parsedTo = parseHistoryDay(to)
  const dateError =
    parsedFrom === undefined || parsedTo === undefined
      ? 'Nhập ngày hợp lệ theo dd/MM/yyyy.'
      : parsedFrom && parsedTo && parsedFrom > parsedTo
        ? 'Ngày từ phải trước hoặc bằng ngày đến.'
        : ''
  const query: HistoryQuery = {
    q: params.get('q') || undefined,
    status: (params.get('status') || undefined) as HistoryQuery['status'],
    from: params.get('from') || undefined,
    to: params.get('to') || undefined,
    page: Math.max(1, Number(params.get('page')) || 1),
    limit: 10,
    sort: params.get('sort') === 'asc' ? 'asc' : 'desc',
  }
  function change(values: Record<string, string>, resetPage = true) {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous)
        for (const [key, value] of Object.entries(values)) {
          if (value) next.set(key, value)
          else next.delete(key)
        }
        if (resetPage) next.delete('page')
        return next
      },
      { replace: true },
    )
  }
  useEffect(() => {
    if (search.trim() === (params.get('q') ?? '')) return
    const timer = setTimeout(
      () =>
        setParams(
          (previous) => {
            const next = new URLSearchParams(previous)
            if (search.trim()) next.set('q', search.trim())
            else next.delete('q')
            next.delete('page')
            return next
          },
          { replace: true },
        ),
      300,
    )
    return () => clearTimeout(timer)
  }, [search, params, setParams])
  const history = useQuery({
    queryKey: ['maintenance-history', me?.id, query],
    queryFn: () => listMaintenanceHistory(query),
    // Router navigation settles after local inputs; never fetch with an older invalid range.
    enabled: !dateError && (query.from ?? '') === parsedFrom && (query.to ?? '') === parsedTo,
    retry: false,
  })
  const filtered = Boolean(query.q || query.status || query.from || query.to)
  const pages = Math.max(1, Math.ceil((history.data?.total ?? 0) / query.limit))
  return (
    <PageContainer>
      <PageHeader
        title="Lịch sử bảo trì"
        subtitle="Các bản ghi do bạn báo cáo hoặc có công việc bảo trì được giao cho bạn."
      />
      <Panel className="mb-6">
        <div
          role="search"
          aria-label="Lọc lịch sử bảo trì"
          className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          <FormField label="Tìm kiếm lịch sử" htmlFor="history-search" className="min-w-0">
            <Input
              id="history-search"
              type="search"
              maxLength={100}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Mô tả, phòng, thiết bị, vị trí"
            />
          </FormField>
          <FormField label="Trạng thái" htmlFor="history-status" className="min-w-0">
            <NativeSelect
              id="history-status"
              value={query.status ?? ''}
              onChange={(e) => change({ status: e.target.value })}
            >
              <option value="">Tất cả</option>
              {Object.entries(HISTORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField label="Thứ tự báo cáo" htmlFor="history-sort" className="min-w-0">
            <NativeSelect
              id="history-sort"
              value={query.sort}
              onChange={(e) => change({ sort: e.target.value })}
            >
              <option value="desc">Mới nhất trước</option>
              <option value="asc">Cũ nhất trước</option>
            </NativeSelect>
          </FormField>
          <FormField label="Từ ngày" htmlFor="history-from" className="min-w-0">
            <Input
              id="history-from"
              placeholder="dd/MM/yyyy"
              inputMode="numeric"
              value={from}
              aria-invalid={dateError ? true : undefined}
              aria-describedby={dateError ? 'history-from-error' : undefined}
              onChange={(e) => {
                setFrom(e.target.value)
                const value = parseHistoryDay(e.target.value)
                if (value !== undefined) change({ from: value })
              }}
            />
            {dateError && (
              <p id="history-from-error" className="text-xs text-destructive">
                {dateError}
              </p>
            )}
          </FormField>
          <FormField label="Đến ngày" htmlFor="history-to" className="min-w-0">
            <Input
              id="history-to"
              placeholder="dd/MM/yyyy"
              inputMode="numeric"
              value={to}
              onChange={(e) => {
                setTo(e.target.value)
                const value = parseHistoryDay(e.target.value)
                if (value !== undefined) change({ to: value })
              }}
            />
          </FormField>
        </div>
      </Panel>
      {dateError && <Alert tone="danger">{dateError}</Alert>}
      {!dateError && history.isPending && (
        <p role="status" className="text-sm text-muted-foreground">
          Đang tải lịch sử bảo trì…
        </p>
      )}
      {!dateError && history.isError && (
        <div className="space-y-3">
          <Alert tone="danger">{getErrorMessage(history.error)}</Alert>
          <Button type="button" onClick={() => void history.refetch()}>
            Thử lại
          </Button>
        </div>
      )}
      {!dateError &&
        history.isSuccess &&
        (history.data.items.length ? (
          <DataTable
            rows={history.data.items}
            caption="Lịch sử bảo trì"
            scrollLabel="Bảng lịch sử bảo trì"
            page={query.page}
            totalPages={pages}
            onPageChange={(page) => change({ page: String(page) }, false)}
            paginationLabel="Phân trang lịch sử bảo trì"
            paginationSummary={`${history.data.total} bản ghi`}
            columns={[
              {
                key: 'reportedAt',
                header: 'Thời điểm báo cáo',
                render: (item) => (
                  <Link
                    className="inline-flex min-h-11 items-center text-primary underline focus-visible:outline-2 focus-visible:outline-ring"
                    aria-label={`Xem bản ghi ${historyDate(item.reportedAt)}`}
                    to={`/operations/maintenance/history/${item.id}${location.search}`}
                  >
                    {historyDate(item.reportedAt)}
                  </Link>
                ),
              },
              {
                key: 'target',
                header: 'Đối tượng',
                className: 'min-w-48 max-w-64',
                render: (item) => <HistoryTarget target={item.target} />,
              },
              {
                key: 'description',
                header: 'Mô tả',
                className: 'max-w-72',
                render: (item) => (
                  <p
                    className="truncate"
                    tabIndex={0}
                    title={item.description}
                    aria-label={item.description}
                  >
                    {item.description}
                  </p>
                ),
              },
              {
                key: 'status',
                header: 'Trạng thái',
                render: (item) => <HistoryStatusBadge status={item.status} />,
              },
              {
                key: 'preventsSafeUse',
                header: 'Ngăn dùng phòng an toàn',
                render: (item) =>
                  item.preventsSafeUse ? <Badge tone="warning">Có</Badge> : 'Không',
              },
            ]}
          />
        ) : (
          <div role="status">
            <EmptyState
              title={
                filtered
                  ? 'Không có kết quả khớp bộ lọc.'
                  : 'Chưa có lịch sử bảo trì trong phạm vi của bạn.'
              }
            />
          </div>
        ))}
    </PageContainer>
  )
}
