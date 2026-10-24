import { useRef, useState, type FormEvent } from 'react'
import { isAxiosError } from 'axios'
import { Link, useParams } from 'react-router'
import { Button } from '@/components/Button'
import { useAuth } from '@/features/auth/auth-context'
import { ServiceTaskIssueReport } from '@/features/issues/ServiceTaskIssueReport'
import type { AssignedTask, TaskProgressInput } from '../api'
import { useAssignedTask, useUpdateTaskProgress } from '../hooks'
import { TaskError, TaskPriorityBadge, TaskStatusBadge } from '../TaskPresentation'
import { taskDate, taskSources } from '../presentation'

function TaskProgress({ task, fetching }: { task: AssignedTask; fetching: boolean }) {
  const mutation = useUpdateTaskProgress(task.id)
  const [workResult, setWorkResult] = useState('')
  const [validation, setValidation] = useState('')
  const submitting = useRef(false)
  const status = isAxiosError(mutation.error) ? mutation.error.response?.status : undefined
  const blocked = status === 403 || status === 404
  const busy = mutation.isPending || fetching
  const errors: Record<number, string> = {
    400: 'Dữ liệu cập nhật không hợp lệ. Vui lòng kiểm tra và thử lại.',
    403: 'Bạn không có quyền cập nhật công việc này.',
    404: 'Không tìm thấy công việc để cập nhật.',
    409: 'Trạng thái công việc đã thay đổi. Đã yêu cầu tải lại chi tiết; vui lòng kiểm tra trước khi thử lại.',
  }

  async function submit(input: TaskProgressInput) {
    if (submitting.current || busy || blocked) return
    submitting.current = true
    try {
      await mutation.mutateAsync(input)
      setWorkResult('')
    } catch {
      return
    } finally {
      submitting.current = false
    }
  }

  function complete(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const result = workResult.trim()
    if (!result || result.length > 2000) {
      setValidation(
        'Vui lòng nhập kết quả thực hiện từ 1 đến 2000 ký tự (không tính khoảng trắng đầu và cuối).',
      )
      return
    }
    setValidation('')
    void submit({ status: 'COMPLETED', workResult: result })
  }

  return (
    <div className="min-w-0 space-y-4 border-t border-stone-300 pt-6">
      {mutation.isPending && <p role="status">Đang cập nhật công việc…</p>}
      {mutation.isSuccess && (
        <p role="status" className="text-success">
          Đã cập nhật tiến độ công việc.
        </p>
      )}
      {mutation.isError && (
        <p role="alert" className="break-words text-danger">
          {errors[status ?? 0] ??
            'Không thể cập nhật công việc. Vui lòng thử lại khi kết nối ổn định.'}
        </p>
      )}
      {task.status === 'ASSIGNED' && (
        <Button
          className="w-full sm:w-auto"
          loading={mutation.isPending}
          disabled={busy || blocked}
          onClick={() => void submit({ status: 'IN_PROGRESS' })}
        >
          Bắt đầu công việc
        </Button>
      )}
      {task.status === 'IN_PROGRESS' && (
        <form onSubmit={complete} noValidate className="min-w-0 space-y-3">
          <label htmlFor="task-work-result" className="block text-sm font-semibold">
            Kết quả thực hiện (bắt buộc)
          </label>
          <textarea
            id="task-work-result"
            required
            rows={5}
            value={workResult}
            disabled={busy || blocked}
            aria-invalid={Boolean(validation)}
            aria-describedby={`task-result-help${validation ? ' task-result-error' : ''}`}
            onChange={(event) => {
              setWorkResult(event.target.value)
              setValidation('')
            }}
            className="w-full min-w-0 rounded border border-stone-300 bg-white p-3 text-sm focus-visible:outline-2 focus-visible:outline-focus"
          />
          <p id="task-result-help" className="text-sm text-stone-700">
            Tối đa 2000 ký tự sau khi bỏ khoảng trắng đầu và cuối. {workResult.trim().length}/2000
          </p>
          {validation && (
            <p id="task-result-error" role="alert" className="text-sm text-danger">
              {validation}
            </p>
          )}
          <Button
            type="submit"
            className="w-full sm:w-auto"
            loading={mutation.isPending}
            disabled={busy || blocked}
          >
            Hoàn thành công việc
          </Button>
        </form>
      )}
    </div>
  )
}

export function AssignedTaskDetailPage() {
  const { id = '' } = useParams()
  const { me } = useAuth()
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
          <TaskProgress key={task.id} task={task} fetching={isFetching} />
        </article>
      )}
      {me?.role === 'SERVICE_STAFF' && task && (
        <ServiceTaskIssueReport
          key={`${me.id}:${task.id}`}
          taskId={task.id}
          eligible={
            !isError &&
            task.sourceType === 'SERVICE_ORDER' &&
            task.taskType === 'SERVICE_ORDER_EXECUTION' &&
            task.status === 'IN_PROGRESS'
          }
        />
      )}
    </section>
  )
}
