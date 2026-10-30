import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router'
import { Alert } from '@/components/Alert'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { SelectField } from '@/components/SelectField'
import { TextField } from '@/components/TextField'
import { ROLE_LABELS } from '@/features/auth/api'
import type { QueueFilters, QueueQuery, QueueStatus } from '../api'
import { useQueueSummary, useQueueTasks } from '../hooks'
import {
  priorityOption,
  queueDate,
  queueTime,
  QUEUE_LABELS,
  QUEUE_STATES,
  SOURCE_LABELS,
} from '../presentation'
import { QueueError, QueuePriority } from '../components/QueuePresentation'

export function TaskQueuesPage() {
  const [params, setParams] = useSearchParams()
  const location = useLocation()
  const [search, setSearch] = useState(params.get('q') ?? '')
  const tabs = useRef<(HTMLButtonElement | null)[]>([])
  const status = QUEUE_STATES.includes(params.get('status') as QueueStatus)
    ? (params.get('status') as QueueStatus)
    : 'ASSIGNED'
  const filters: QueueFilters = {
    taskType: params.get('taskType') || undefined,
    sourceType: (params.get('sourceType') || undefined) as QueueFilters['sourceType'],
    priority: params.get('priority') || undefined,
    assigneeId: params.get('assigneeId') || undefined,
    q: params.get('q') || undefined,
  }
  const query: QueueQuery = {
    ...filters,
    status,
    overdue: params.get('overdue') === 'true' ? true : undefined,
    page: Math.max(1, Number(params.get('page')) || 1),
    limit: 10,
    sortBy: (params.get('sortBy') ||
      (status === 'COMPLETED' ? 'completedAt' : 'dueAt')) as QueueQuery['sortBy'],
    sortOrder: (params.get('sortOrder') ||
      (status === 'COMPLETED' ? 'desc' : 'asc')) as QueueQuery['sortOrder'],
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
  const summary = useQueueSummary(filters)
  const tasks = useQueueTasks(query)
  const counts = summary.data?.counts
  const filtered = Object.values(filters).some(Boolean) || Boolean(query.overdue)
  const empty = filtered
    ? 'Không có task khớp bộ lọc.'
    : counts?.total === 0
      ? 'Chưa có task nào.'
      : 'Hàng đợi này đang trống.'
  const pages = Math.max(1, Math.ceil((tasks.data?.total ?? 0) / query.limit))
  const selectTab = (next: QueueStatus) => change({ status: next, sortBy: '', sortOrder: '' })
  function tabKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const key = event.key
    let next = index
    if (['ArrowRight', 'ArrowDown'].includes(key)) next = (index + 1) % 3
    else if (['ArrowLeft', 'ArrowUp'].includes(key)) next = (index + 2) % 3
    else if (key === 'Home') next = 0
    else if (key === 'End') next = 2
    else return
    event.preventDefault()
    selectTab(QUEUE_STATES[next])
    tabs.current[next]?.focus()
  }
  const staff = summary.data?.workload.flatMap((row) => (row.assignee ? [row.assignee] : [])) ?? []
  return (
    <section className="mx-auto max-w-container space-y-6 px-4 py-10 font-body">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-semibold">Hàng đợi task</h1>
          <p className="mt-2 text-sm text-stone-700">
            Giám sát công việc hiện tại trong toàn khách sạn. Chỉ xem.
          </p>
        </div>
        <Button
          disabled={summary.isFetching || tasks.isFetching}
          onClick={() => {
            void summary.refetch()
            void tasks.refetch()
          }}
        >
          Làm mới
        </Button>
      </div>
      <div
        role="search"
        aria-label="Lọc hàng đợi task"
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        <TextField
          label="Tìm tiêu đề"
          type="search"
          maxLength={100}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <SelectField
          label="Loại task"
          value={filters.taskType ?? ''}
          options={[
            { value: '', label: 'Tất cả loại task' },
            ...(summary.data?.facets.taskTypes ?? []).map((value) => ({ value, label: value })),
          ]}
          onChange={(e) => change({ taskType: e.target.value })}
        />
        <SelectField
          label="Nguồn task"
          value={filters.sourceType ?? ''}
          options={[
            { value: '', label: 'Tất cả nguồn' },
            ...Object.entries(SOURCE_LABELS).map(([value, label]) => ({ value, label })),
          ]}
          onChange={(e) => change({ sourceType: e.target.value })}
        />
        <SelectField
          label="Ưu tiên"
          value={filters.priority ?? ''}
          options={[
            { value: '', label: 'Tất cả ưu tiên' },
            ...(summary.data?.facets.priorities ?? []).map((value) => ({
              value,
              label: priorityOption(value),
            })),
          ]}
          onChange={(e) => change({ priority: e.target.value })}
        />
        <SelectField
          label="Người thực hiện"
          value={filters.assigneeId ?? ''}
          options={[
            { value: '', label: 'Tất cả nhân viên' },
            ...staff.map((person) => ({
              value: person.id,
              label: `${person.fullName} · ${ROLE_LABELS[person.role] ?? person.role}`,
            })),
            ...(filters.assigneeId && !staff.some((p) => p.id === filters.assigneeId)
              ? [{ value: filters.assigneeId, label: 'Nhân viên đã chọn' }]
              : []),
          ]}
          onChange={(e) => change({ assigneeId: e.target.value })}
        />
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input
            className="size-5"
            type="checkbox"
            checked={Boolean(query.overdue)}
            onChange={(e) => change({ overdue: e.target.checked ? 'true' : '' })}
          />
          Chỉ quá hạn trong bảng
        </label>
      </div>
      <section aria-label="Số liệu hàng đợi" className="space-y-3">
        {summary.isFetching && summary.data && <p role="status">Đang cập nhật số liệu hàng đợi…</p>}
        {summary.isPending && <p role="status">Đang tải số liệu hàng đợi…</p>}
        {summary.isError && (
          <QueueError error={summary.error} retry={() => void summary.refetch()} />
        )}
        <div role="tablist" aria-label="Chọn hàng đợi" className="grid gap-3 sm:grid-cols-3">
          {QUEUE_STATES.map((value, index) => (
            <button
              key={value}
              ref={(element) => {
                tabs.current[index] = element
              }}
              type="button"
              role="tab"
              id={`queue-${value}`}
              aria-selected={value === status}
              aria-controls="queue-panel"
              tabIndex={value === status ? 0 : -1}
              onClick={() => selectTab(value)}
              onKeyDown={(e) => tabKey(e, index)}
              className={`min-h-24 rounded border p-4 text-left hover:border-primary ${value === status ? 'border-primary bg-brandy-100' : 'border-stone-300 bg-white'}`}
            >
              <span className="block text-sm font-semibold">{QUEUE_LABELS[value]}</span>
              <span className="mt-2 block text-3xl font-semibold">
                {counts
                  ? counts[
                      value === 'ASSIGNED'
                        ? 'assigned'
                        : value === 'IN_PROGRESS'
                          ? 'inProgress'
                          : 'completed'
                    ]
                  : '—'}
              </span>
            </button>
          ))}
        </div>
        {summary.data && (
          <div className="flex flex-wrap items-center gap-4">
            <Badge tone="warning">Quá hạn: {summary.data.overdue}</Badge>
            <p aria-live="polite" className="text-sm text-stone-700">
              Cập nhật lúc{' '}
              <time dateTime={summary.data.generatedAt}>{queueTime(summary.data.generatedAt)}</time>{' '}
              · {summary.data.counts.total} task
            </p>
          </div>
        )}
        {!!counts?.other && (
          <Alert tone="warning">Có {counts.other} task có trạng thái không xác định.</Alert>
        )}
        <p className="text-xs text-stone-700">
          Số liệu tính theo các bộ lọc chung. “Chỉ quá hạn” áp dụng cho bảng task. Dữ liệu làm mới
          khi quay lại cửa sổ hoặc bấm Làm mới.
        </p>
      </section>
      <section
        role="tabpanel"
        id="queue-panel"
        aria-labelledby={`queue-${status}`}
        className="space-y-4"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="Sắp xếp theo"
            value={query.sortBy}
            options={[
              { value: 'dueAt', label: 'Hạn hoàn thành' },
              { value: 'assignedAt', label: 'Thời điểm giao' },
              { value: 'completedAt', label: 'Thời điểm hoàn thành' },
            ]}
            onChange={(e) => change({ sortBy: e.target.value })}
          />
          <SelectField
            label="Thứ tự"
            value={query.sortOrder}
            options={[
              { value: 'asc', label: 'Sớm nhất trước' },
              { value: 'desc', label: 'Mới nhất trước' },
            ]}
            onChange={(e) => change({ sortOrder: e.target.value })}
          />
        </div>
        {tasks.isPending && <p role="status">Đang tải task…</p>}
        {tasks.isError && <QueueError error={tasks.error} retry={() => void tasks.refetch()} />}
        {tasks.data &&
          (tasks.data.items.length ? (
            <>
              <div className="overflow-x-auto rounded border border-stone-300 bg-white">
                <table
                  aria-label="Task trong hàng đợi"
                  className="w-full min-w-200 text-left text-sm"
                >
                  <thead className="bg-stone-200 text-xs text-stone-700 uppercase">
                    <tr>
                      {[
                        'Tiêu đề',
                        'Loại',
                        'Ưu tiên',
                        'Người thực hiện',
                        'Hạn',
                        'Giao lúc',
                        ...(status === 'COMPLETED' ? ['Hoàn thành lúc'] : []),
                      ].map((label) => (
                        <th scope="col" className="px-4 py-3" key={label}>
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tasks.data.items.map((task) => (
                      <tr key={task.id} className="border-t border-stone-300 hover:bg-cream-50">
                        <td className="max-w-72 px-4 py-2">
                          <Link
                            className="inline-flex min-h-11 items-center break-words text-primary underline"
                            to={`/manager/task-queues/${task.id}${location.search}`}
                          >
                            {' '}
                            {task.title}
                          </Link>
                        </td>
                        <td className="px-4 py-3">{task.taskType}</td>
                        <td className="px-4 py-3">
                          <QueuePriority priority={task.priority} />
                        </td>
                        <td className="px-4 py-3">
                          {task.assignee?.fullName ?? 'Không còn nhân viên'}
                        </td>
                        <td className="space-y-1 px-4 py-3">
                          <p>{queueDate(task.dueAt)}</p>
                          <Badge tone="neutral">
                            {QUEUE_LABELS[task.status as QueueStatus] ?? task.status}
                          </Badge>
                          {task.blocked && <Badge tone="danger">Bị chặn</Badge>}
                          {task.overdue && <Badge tone="danger">Quá hạn</Badge>}
                        </td>
                        <td className="px-4 py-3">{queueDate(task.assignedAt)}</td>
                        {status === 'COMPLETED' && (
                          <td className="px-4 py-3">{queueDate(task.completedAt)}</td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <nav aria-label="Phân trang task" className="flex flex-wrap items-center gap-4">
                <Button
                  variant="secondary"
                  disabled={query.page <= 1}
                  onClick={() => change({ page: String(query.page - 1) }, false)}
                >
                  Trang trước
                </Button>
                <span>
                  Trang {query.page}/{pages} · {tasks.data.total} task
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
            <p role="status">{empty}</p>
          ))}
      </section>
      <section aria-label="Khối lượng công việc" className="space-y-4">
        <h2 className="text-xl font-semibold">Khối lượng công việc</h2>
        {summary.isPending && <p role="status">Đang tải khối lượng công việc…</p>}
        {summary.isError && (
          <QueueError error={summary.error} retry={() => void summary.refetch()} />
        )}
        {summary.data &&
          (summary.data.workload.length ? (
            <div className="overflow-x-auto rounded border border-stone-300 bg-white">
              <table
                aria-label="Khối lượng công việc theo nhân viên"
                className="w-full min-w-160 text-left text-sm"
              >
                <thead className="bg-stone-200 text-xs text-stone-700 uppercase">
                  <tr>
                    {[
                      'Nhân viên',
                      'Vai trò',
                      'Đang giao',
                      'Đang xử lý',
                      'Hoàn thành',
                      'Quá hạn',
                    ].map((label) => (
                      <th className="px-4 py-3" scope="col" key={label}>
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {summary.data.workload.map((row, index) => (
                    <tr
                      key={row.assignee?.id ?? `missing-${index}`}
                      className="border-t border-stone-300"
                    >
                      <td className="px-4 py-1">
                        {row.assignee ? (
                          <Button
                            variant="ghost"
                            onClick={() => change({ assigneeId: row.assignee!.id })}
                          >
                            {row.assignee.fullName}
                          </Button>
                        ) : (
                          'Không còn nhân viên'
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {row.assignee ? (ROLE_LABELS[row.assignee.role] ?? row.assignee.role) : '—'}
                      </td>
                      {[row.assigned, row.inProgress, row.completed, row.overdue].map(
                        (value, i) => (
                          <td className="px-4 py-3 text-right" key={i}>
                            {value}
                          </td>
                        ),
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p role="status">{filtered ? 'Không có task khớp bộ lọc.' : 'Chưa có task nào.'}</p>
          ))}
        <p className="text-xs text-stone-700">
          Tối đa 100 nhân viên, ưu tiên khối lượng công việc đang mở nhiều nhất.
        </p>
      </section>
    </section>
  )
}
