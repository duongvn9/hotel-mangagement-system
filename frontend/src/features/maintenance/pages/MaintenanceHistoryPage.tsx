import { useEffect, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { Alert } from '@/components/Alert'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { SelectField } from '@/components/SelectField'
import { TextField } from '@/components/TextField'
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
    <section className="mx-auto max-w-container space-y-6 px-4 py-10 font-body">
      <div>
        <h1 className="font-display text-4xl font-semibold">Lịch sử bảo trì</h1>
        <p className="mt-2 text-sm text-stone-700">
          Các bản ghi do bạn báo cáo hoặc có công việc bảo trì được giao cho bạn.
        </p>
      </div>
      <div
        role="search"
        aria-label="Lọc lịch sử bảo trì"
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        <TextField
          label="Tìm kiếm lịch sử"
          type="search"
          maxLength={100}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Mô tả, phòng, thiết bị, vị trí"
        />
        <SelectField
          label="Trạng thái"
          value={query.status ?? ''}
          options={[
            { value: '', label: 'Tất cả' },
            ...Object.entries(HISTORY_LABELS).map(([value, label]) => ({ value, label })),
          ]}
          onChange={(e) => change({ status: e.target.value })}
        />
        <SelectField
          label="Thứ tự báo cáo"
          value={query.sort}
          options={[
            { value: 'desc', label: 'Mới nhất trước' },
            { value: 'asc', label: 'Cũ nhất trước' },
          ]}
          onChange={(e) => change({ sort: e.target.value })}
        />
        <TextField
          label="Từ ngày"
          placeholder="dd/MM/yyyy"
          inputMode="numeric"
          value={from}
          error={dateError || undefined}
          onChange={(e) => {
            setFrom(e.target.value)
            const value = parseHistoryDay(e.target.value)
            if (value !== undefined) change({ from: value })
          }}
        />
        <TextField
          label="Đến ngày"
          placeholder="dd/MM/yyyy"
          inputMode="numeric"
          value={to}
          onChange={(e) => {
            setTo(e.target.value)
            const value = parseHistoryDay(e.target.value)
            if (value !== undefined) change({ to: value })
          }}
        />
      </div>
      {dateError && <Alert tone="danger">{dateError}</Alert>}
      {!dateError && history.isPending && <p role="status">Đang tải lịch sử bảo trì…</p>}
      {!dateError && history.isError && (
        <div className="space-y-3">
          <Alert tone="danger">{getErrorMessage(history.error)}</Alert>
          <Button onClick={() => void history.refetch()}>Thử lại</Button>
        </div>
      )}
      {!dateError &&
        history.isSuccess &&
        (history.data.items.length ? (
          <>
            <div className="overflow-x-auto rounded border border-stone-300 bg-white">
              <table aria-label="Lịch sử bảo trì" className="w-full min-w-190 text-left text-sm">
                <thead className="h-11 bg-stone-200 text-xs text-stone-700 uppercase">
                  <tr>
                    {[
                      'Thời điểm báo cáo',
                      'Đối tượng',
                      'Mô tả',
                      'Trạng thái',
                      'Ngăn dùng phòng an toàn',
                    ].map((label) => (
                      <th scope="col" className="px-4 py-3" key={label}>
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {history.data.items.map((item) => (
                    <tr key={item.id} className="border-t border-stone-300 hover:bg-cream-50">
                      <td className="px-4 py-2">
                        <Link
                          className="inline-flex min-h-11 items-center text-primary underline"
                          aria-label={`Xem bản ghi ${historyDate(item.reportedAt)}`}
                          to={`/operations/maintenance/history/${item.id}${location.search}`}
                        >
                          {historyDate(item.reportedAt)}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <HistoryTarget target={item.target} />
                      </td>
                      <td className="max-w-72 px-4 py-3">
                        <p
                          className="truncate"
                          tabIndex={0}
                          title={item.description}
                          aria-label={item.description}
                        >
                          {item.description}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <HistoryStatusBadge status={item.status} />
                      </td>
                      <td className="px-4 py-3">
                        {item.preventsSafeUse ? <Badge tone="warning">Có</Badge> : 'Không'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <nav
              aria-label="Phân trang lịch sử bảo trì"
              className="flex flex-wrap items-center gap-4"
            >
              <Button
                variant="secondary"
                disabled={query.page <= 1}
                onClick={() => change({ page: String(query.page - 1) }, false)}
              >
                Trang trước
              </Button>
              <span>
                Trang {query.page}/{pages} · {history.data.total} bản ghi
              </span>
              <Button
                variant="secondary"
                disabled={query.page >= pages}
                onClick={() => change({ page: String(query.page + 1) }, false)}
              >
                Trang sau
              </Button>
            </nav>
          </>
        ) : (
          <p role="status">
            {filtered
              ? 'Không có kết quả khớp bộ lọc.'
              : 'Chưa có lịch sử bảo trì trong phạm vi của bạn.'}
          </p>
        ))}
    </section>
  )
}
