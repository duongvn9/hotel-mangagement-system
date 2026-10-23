import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/Button'
import { SelectField } from '@/components/SelectField'
import { TextField } from '@/components/TextField'
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
    <section className="mx-auto max-w-container space-y-6 px-4 py-10 font-body">
      <h1 className="font-display text-4xl font-semibold">Công việc được giao</h1>
      <p className="text-sm text-stone-700">
        Danh sách công việc được giao cho bạn. Chỉ xem, không thay đổi tiến độ.
      </p>
      <form
        role="search"
        aria-label="Lọc công việc"
        onSubmit={filter}
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <TextField
          label="Tìm theo tiêu đề"
          type="search"
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
        />
        <TextField
          label="Loại công việc (chính xác)"
          value={taskType}
          onChange={(event) => setTaskType(event.target.value)}
        />
        <SelectField
          label="Trạng thái"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          options={[
            { value: '', label: 'Tất cả' },
            ...Object.entries(taskStatuses).map(([value, label]) => ({ value, label })),
          ]}
        />
        <Button type="submit" className="self-end" disabled={isFetching}>
          Áp dụng bộ lọc
        </Button>
      </form>
      {isPending && <p role="status">Đang tải công việc…</p>}
      {isError && <TaskError error={error} retry={() => void refetch()} fetching={isFetching} />}
      {!isError && data && (
        <>
          {data.items.length === 0 ? (
            <p
              role="status"
              className="rounded-lg border border-stone-300 bg-white p-6 text-stone-700"
            >
              {filtered ? 'Không có công việc khớp bộ lọc.' : 'Bạn chưa có công việc được giao.'}
            </p>
          ) : (
            <ul className="grid gap-4 md:grid-cols-2" aria-label="Danh sách công việc">
              {data.items.map((task) => (
                <li
                  key={task.id}
                  className="min-w-0 space-y-3 rounded-lg border border-stone-300 bg-white p-4 sm:p-6"
                >
                  <h2 className="text-lg font-semibold break-words">
                    <Link
                      className="text-primary underline underline-offset-4"
                      to={`/staff/tasks/${encodeURIComponent(task.id)}`}
                    >
                      {task.title}
                    </Link>
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    <TaskStatusBadge status={task.status} />
                    <TaskPriorityBadge priority={task.priority} />
                  </div>
                  <p className="text-sm break-words">Loại: {task.taskType}</p>
                  <p className="text-sm text-stone-700">Ngày giao: {taskDate(task.assignedAt)}</p>
                  <p className="text-sm text-stone-700">Hạn hoàn thành: {taskDate(task.dueAt)}</p>
                </li>
              ))}
            </ul>
          )}
          <nav
            aria-label="Phân trang công việc"
            className="flex flex-wrap items-center justify-between gap-3"
          >
            <p className="text-sm text-stone-700" aria-live="polite">
              {data.total} công việc · Trang {data.page}/{pages}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                disabled={data.page <= 1 || isFetching}
                onClick={() => setQuery({ ...query, page: data.page - 1 })}
              >
                Trang trước
              </Button>
              <Button
                variant="secondary"
                disabled={data.page >= pages || isFetching}
                onClick={() => setQuery({ ...query, page: data.page + 1 })}
              >
                Trang sau
              </Button>
            </div>
          </nav>
        </>
      )}
    </section>
  )
}
