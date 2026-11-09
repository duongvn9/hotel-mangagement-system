import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { Button, Input, NativeSelect } from '@/components/atoms'
import { EmptyState, FormField } from '@/components/molecules'
import { PageContainer, PageHeader, Panel } from '@/components/organisms'
import type { TaskQuery, TaskStatus } from '../api'
import { useAssignedTasks } from '../hooks'
import { TaskError, TaskPriorityBadge, TaskStatusBadge } from '../TaskPresentation'
import { taskDate, taskStatuses } from '../presentation'

export function AssignedTasksPage() {
  const [keyword, setKeyword] = useState('')
  const [taskType, setTaskType] = useState('')
  const [status, setStatus] = useState('')
  const [query, setQuery] = useState<TaskQuery>({ page: 1, limit: 20 })
  const { data, isPending, isError, error, refetch, isFetching } = useAssignedTasks(query)
  const pages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1
  const filtered = Boolean(query.keyword || query.taskType || query.status)

  function filter(event: FormEvent) {
    event.preventDefault()
    setQuery({
      page: 1,
      limit: query.limit,
      keyword: keyword || undefined,
      taskType: taskType || undefined,
      status: (status || undefined) as TaskStatus | undefined,
    })
  }

  return (
    <PageContainer>
      <PageHeader
        title="Công việc được giao"
        subtitle="Danh sách công việc được giao cho bạn. Mở chi tiết công việc của bạn để cập nhật tiến độ."
      />
      <div className="space-y-6">
        <Panel>
          <form
            role="search"
            aria-label="Lọc công việc"
            onSubmit={filter}
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
          >
            <FormField label="Tìm theo tiêu đề" htmlFor="task-keyword">
              <Input
                id="task-keyword"
                type="search"
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
              />
            </FormField>
            <FormField label="Loại công việc (chính xác)" htmlFor="task-type">
              <Input
                id="task-type"
                value={taskType}
                onChange={(event) => setTaskType(event.target.value)}
              />
            </FormField>
            <FormField label="Trạng thái" htmlFor="task-status">
              <NativeSelect
                id="task-status"
                value={status}
                onChange={(event) => setStatus(event.target.value)}
              >
                <option value="">Tất cả</option>
                {Object.entries(taskStatuses).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <Button type="submit" className="self-end rounded-full" disabled={isFetching}>
              Áp dụng bộ lọc
            </Button>
          </form>
        </Panel>
        {isPending && (
          <p role="status" className="text-sm text-muted-foreground">
            Đang tải công việc…
          </p>
        )}
        {isError && <TaskError error={error} retry={() => void refetch()} fetching={isFetching} />}
        {!isError && data && (
          <>
            {data.items.length === 0 ? (
              <div role="status">
                <EmptyState
                  title={
                    filtered
                      ? 'Không có công việc khớp bộ lọc.'
                      : 'Bạn chưa có công việc được giao.'
                  }
                />
              </div>
            ) : (
              <ul className="grid gap-4 md:grid-cols-2" aria-label="Danh sách công việc">
                {data.items.map((task) => (
                  <li key={task.id} className="min-w-0">
                    <Panel className="h-full min-w-0">
                      <div className="space-y-3">
                        <div className="flex flex-wrap gap-3">
                          <TaskStatusBadge status={task.status} />
                          <TaskPriorityBadge priority={task.priority} />
                        </div>
                        <h2 className="text-sm font-semibold">
                          <Link
                            className="rounded-sm break-words text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
                            to={`/staff/tasks/${encodeURIComponent(task.id)}`}
                          >
                            {task.title}
                          </Link>
                        </h2>
                        <p className="text-sm break-words">Loại: {task.taskType}</p>
                        <p className="text-xs text-muted-foreground">
                          Ngày giao: {taskDate(task.assignedAt)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Hạn hoàn thành: {taskDate(task.dueAt)}
                        </p>
                      </div>
                    </Panel>
                  </li>
                ))}
              </ul>
            )}
            <nav
              aria-label="Phân trang công việc"
              className="flex flex-wrap items-center justify-between gap-3"
            >
              <p className="text-sm text-muted-foreground" aria-live="polite">
                {data.total} công việc · Trang {data.page}/{pages}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  className="rounded-full"
                  disabled={data.page <= 1 || isFetching}
                  onClick={() => setQuery({ ...query, page: data.page - 1 })}
                >
                  Trang trước
                </Button>
                <Button
                  variant="outline"
                  className="rounded-full"
                  disabled={data.page >= pages || isFetching}
                  onClick={() => setQuery({ ...query, page: data.page + 1 })}
                >
                  Trang sau
                </Button>
              </div>
            </nav>
          </>
        )}
      </div>
    </PageContainer>
  )
}
