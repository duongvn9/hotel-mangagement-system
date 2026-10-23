import { Link, useParams } from 'react-router'
import { useAssignedTask } from '../hooks'
import { TaskError, TaskPriorityBadge, TaskStatusBadge } from '../TaskPresentation'
import { taskDate, taskSources } from '../presentation'

export function AssignedTaskDetailPage() {
  const { id = '' } = useParams()
  const { data: task, isPending, isError, error, refetch, isFetching } = useAssignedTask(id)

  return (
    <section className="mx-auto max-w-container space-y-6 px-4 py-10 font-body">
      <Link to="/staff/tasks" className="inline-flex min-h-11 items-center text-primary underline">
        Về công việc được giao
      </Link>
      <h1 className="font-display text-4xl font-semibold">Chi tiết công việc</h1>
      {isPending && <p role="status">Đang tải công việc…</p>}
      {isError && <TaskError error={error} retry={() => void refetch()} fetching={isFetching} />}
      {!isError && task && (
        <article className="min-w-0 space-y-6 rounded-lg border border-stone-300 bg-white p-4 sm:p-6">
          <h2 className="text-xl font-semibold break-words">{task.title}</h2>
          <div className="flex flex-wrap gap-2">
            <TaskStatusBadge status={task.status} />
            <TaskPriorityBadge priority={task.priority} />
          </div>
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            {[
              ['Mã công việc', task.id],
              ['Loại công việc', task.taskType],
              ['Ngày giao', taskDate(task.assignedAt)],
              ['Hạn hoàn thành', taskDate(task.dueAt)],
              ['Ngày hoàn thành', taskDate(task.completedAt)],
              ['Kết quả thực hiện', task.workResult || 'Chưa có kết quả'],
              ['Nguồn công việc', taskSources[task.sourceType]],
              ['Mã nguồn tham chiếu', task.sourceId],
            ].map(([label, value]) => (
              <div key={label} className="min-w-0">
                <dt className="font-semibold text-stone-700">{label}</dt>
                <dd className="mt-1 break-words whitespace-pre-wrap">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="text-sm text-stone-700">
            Thông tin nguồn hiện không khả dụng. Công việc vẫn có thể được xem; mã nguồn chỉ dùng để
            đối chiếu.
          </p>
        </article>
      )}
    </section>
  )
}
