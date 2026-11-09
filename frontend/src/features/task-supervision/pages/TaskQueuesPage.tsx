import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router'
import { Badge, Button, Input, Label, NativeSelect } from '@/components/atoms'
import { Alert, EmptyState, FormField } from '@/components/molecules'
import { DataTable, PageContainer, PageHeader, Panel } from '@/components/organisms'
import { ROLE_LABELS } from '@/features/auth/api'
import type { QueueFilters, QueueQuery, QueueStatus, QueueTask } from '../api'
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
    <PageContainer>
      <PageHeader
        title="Hàng đợi task"
        subtitle="Giám sát công việc hiện tại trong toàn khách sạn. Chỉ xem."
        actions={
          <Button
            className="rounded-full"
            disabled={summary.isFetching || tasks.isFetching}
            onClick={() => {
              void summary.refetch()
              void tasks.refetch()
            }}
          >
            Làm mới
          </Button>
        }
      />
      <div className="space-y-6">
        <Panel>
          <div
            role="search"
            aria-label="Lọc hàng đợi task"
            className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            <FormField label="Tìm tiêu đề" htmlFor="queue-search" className="min-w-0">
              <Input
                id="queue-search"
                type="search"
                maxLength={100}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </FormField>
            <FormField label="Loại task" htmlFor="queue-type" className="min-w-0">
              <NativeSelect
                id="queue-type"
                value={filters.taskType ?? ''}
                onChange={(e) => change({ taskType: e.target.value })}
              >
                {[
                  { value: '', label: 'Tất cả loại task' },
                  ...(summary.data?.facets.taskTypes ?? []).map((value) => ({
                    value,
                    label: value,
                  })),
                ].map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField label="Nguồn task" htmlFor="queue-source" className="min-w-0">
              <NativeSelect
                id="queue-source"
                value={filters.sourceType ?? ''}
                onChange={(e) => change({ sourceType: e.target.value })}
              >
                {[
                  { value: '', label: 'Tất cả nguồn' },
                  ...Object.entries(SOURCE_LABELS).map(([value, label]) => ({ value, label })),
                ].map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField label="Ưu tiên" htmlFor="queue-priority" className="min-w-0">
              <NativeSelect
                id="queue-priority"
                value={filters.priority ?? ''}
                onChange={(e) => change({ priority: e.target.value })}
              >
                {[
                  { value: '', label: 'Tất cả ưu tiên' },
                  ...(summary.data?.facets.priorities ?? []).map((value) => ({
                    value,
                    label: priorityOption(value),
                  })),
                ].map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField label="Người thực hiện" htmlFor="queue-assignee" className="min-w-0">
              <NativeSelect
                id="queue-assignee"
                value={filters.assigneeId ?? ''}
                onChange={(e) => change({ assigneeId: e.target.value })}
              >
                {[
                  { value: '', label: 'Tất cả nhân viên' },
                  ...staff.map((person) => ({
                    value: person.id,
                    label: `${person.fullName} · ${ROLE_LABELS[person.role] ?? person.role}`,
                  })),
                  ...(filters.assigneeId && !staff.some((p) => p.id === filters.assigneeId)
                    ? [{ value: filters.assigneeId, label: 'Nhân viên đã chọn' }]
                    : []),
                ].map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <Label className="flex min-h-11 items-center gap-3 text-sm">
              <Input
                className="size-4 shrink-0 p-0 accent-primary shadow-none"
                type="checkbox"
                checked={Boolean(query.overdue)}
                onChange={(e) => change({ overdue: e.target.checked ? 'true' : '' })}
              />
              Chỉ quá hạn trong bảng
            </Label>
          </div>
        </Panel>
        <section aria-label="Số liệu hàng đợi" className="space-y-3">
          {summary.isFetching && summary.data && (
            <p role="status">Đang cập nhật số liệu hàng đợi…</p>
          )}
          {summary.isPending && <p role="status">Đang tải số liệu hàng đợi…</p>}
          {summary.isError && (
            <QueueError error={summary.error} retry={() => void summary.refetch()} />
          )}
          <div role="tablist" aria-label="Chọn hàng đợi" className="grid gap-3 sm:grid-cols-3">
            {QUEUE_STATES.map((value, index) => (
              <Button
                variant="outline"
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
                className={`h-auto min-h-24 flex-col items-start justify-start whitespace-normal rounded-xl p-5 text-left focus-visible:ring-2 focus-visible:ring-ring ${value === status ? 'border-primary bg-primary/10' : 'border-border bg-card'}`}
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
              </Button>
            ))}
          </div>
          {summary.data && (
            <div className="flex flex-wrap items-center gap-4">
              <Badge tone="warning">
                <span>Quá hạn: {summary.data.overdue}</span>
              </Badge>
              <p aria-live="polite" className="text-sm text-muted-foreground">
                Cập nhật lúc{' '}
                <time dateTime={summary.data.generatedAt}>
                  {queueTime(summary.data.generatedAt)}
                </time>{' '}
                · {summary.data.counts.total} task
              </p>
            </div>
          )}
          {!!counts?.other && (
            <Alert tone="warning">Có {counts.other} task có trạng thái không xác định.</Alert>
          )}
          <p className="text-xs text-muted-foreground">
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
            <FormField label="Sắp xếp theo" htmlFor="queue-sort" className="min-w-0">
              <NativeSelect
                id="queue-sort"
                value={query.sortBy}
                onChange={(e) => change({ sortBy: e.target.value })}
              >
                {[
                  { value: 'dueAt', label: 'Hạn hoàn thành' },
                  { value: 'assignedAt', label: 'Thời điểm giao' },
                  { value: 'completedAt', label: 'Thời điểm hoàn thành' },
                ].map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField label="Thứ tự" htmlFor="queue-order" className="min-w-0">
              <NativeSelect
                id="queue-order"
                value={query.sortOrder}
                onChange={(e) => change({ sortOrder: e.target.value })}
              >
                {[
                  { value: 'asc', label: 'Sớm nhất trước' },
                  { value: 'desc', label: 'Mới nhất trước' },
                ].map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
          </div>
          {tasks.isPending && <p role="status">Đang tải task…</p>}
          {tasks.isError && <QueueError error={tasks.error} retry={() => void tasks.refetch()} />}
          {tasks.data &&
            (tasks.data.items.length ? (
              <DataTable
                rows={tasks.data.items}
                caption="Task trong hàng đợi"
                scrollLabel="Bảng task trong hàng đợi"
                page={query.page}
                totalPages={pages}
                onPageChange={(page) => change({ page: String(page) }, false)}
                paginationLabel="Phân trang task"
                paginationSummary={`${tasks.data.total} task`}
                columns={[
                  {
                    key: 'title',
                    header: 'Tiêu đề',
                    className: 'min-w-48 max-w-72',
                    render: (task) => (
                      <Link
                        className="flex min-h-11 min-w-0 items-center text-primary underline focus-visible:outline-2 focus-visible:outline-ring"
                        to={`/manager/task-queues/${task.id}${location.search}`}
                      >
                        <span className="min-w-0 break-all">{task.title}</span>
                      </Link>
                    ),
                  },
                  { key: 'taskType', header: 'Loại' },
                  {
                    key: 'priority',
                    header: 'Ưu tiên',
                    render: (task) => <QueuePriority priority={task.priority} />,
                  },
                  {
                    key: 'assignee',
                    header: 'Người thực hiện',
                    className: 'min-w-40 max-w-64 break-words',
                    render: (task) => task.assignee?.fullName ?? 'Không còn nhân viên',
                  },
                  {
                    key: 'dueAt',
                    header: 'Hạn',
                    render: (task) => (
                      <div className="space-y-1">
                        <p>{queueDate(task.dueAt)}</p>
                        <Badge tone="neutral">
                          <span>{QUEUE_LABELS[task.status as QueueStatus] ?? task.status}</span>
                        </Badge>
                        {task.blocked && (
                          <Badge tone="danger">
                            <span>Bị chặn</span>
                          </Badge>
                        )}
                        {task.overdue && (
                          <Badge tone="danger">
                            <span>Quá hạn</span>
                          </Badge>
                        )}
                      </div>
                    ),
                  },
                  {
                    key: 'assignedAt',
                    header: 'Giao lúc',
                    render: (task) => queueDate(task.assignedAt),
                  },
                  ...(status === 'COMPLETED'
                    ? [
                        {
                          key: 'completedAt',
                          header: 'Hoàn thành lúc',
                          render: (task: QueueTask) => queueDate(task.completedAt),
                        },
                      ]
                    : []),
                ]}
              />
            ) : (
              <div role="status">
                <EmptyState title={empty} />
              </div>
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
              <DataTable
                rows={summary.data.workload.map((row, index) => ({
                  ...row,
                  id: row.assignee?.id ?? `missing-${index}`,
                }))}
                showPagination={false}
                caption="Khối lượng công việc theo nhân viên"
                scrollLabel="Bảng khối lượng công việc"
                columns={[
                  {
                    key: 'assignee',
                    header: 'Nhân viên',
                    className: 'min-w-40 max-w-64',
                    render: (row) =>
                      row.assignee ? (
                        <Button
                          variant="ghost"
                          className="h-auto max-w-full justify-start whitespace-normal"
                          onClick={() => change({ assigneeId: row.assignee!.id })}
                        >
                          <span className="min-w-0 break-all text-left">
                            {row.assignee.fullName}
                          </span>
                        </Button>
                      ) : (
                        'Không còn nhân viên'
                      ),
                  },
                  {
                    key: 'role',
                    header: 'Vai trò',
                    render: (row) =>
                      row.assignee ? (ROLE_LABELS[row.assignee.role] ?? row.assignee.role) : '—',
                  },
                  { key: 'assigned', header: 'Đang giao', className: 'text-right' },
                  { key: 'inProgress', header: 'Đang xử lý', className: 'text-right' },
                  { key: 'completed', header: 'Hoàn thành', className: 'text-right' },
                  { key: 'overdue', header: 'Quá hạn', className: 'text-right' },
                ]}
              />
            ) : (
              <div role="status">
                <EmptyState title={filtered ? 'Không có task khớp bộ lọc.' : 'Chưa có task nào.'} />
              </div>
            ))}
          <p className="text-xs text-muted-foreground">
            Tối đa 100 nhân viên, ưu tiên khối lượng công việc đang mở nhiều nhất.
          </p>
        </section>
      </div>
    </PageContainer>
  )
}
