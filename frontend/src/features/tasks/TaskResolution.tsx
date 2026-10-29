import { useState } from 'react'
import { isAxiosError } from 'axios'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/Button'
import { useAuth } from '@/features/auth/auth-context'
import { reportUnableToResolve, type AssignedTask, type TaskResolution } from './api'
import { taskDate } from './presentation'

export function ResolutionHistory({ task }: { task: TaskResolution }) {
  return (
    <section className="space-y-3 break-words" aria-label="Lịch sử xử lý công việc">
      {task.blocked && (
        <p role="status" className="text-danger">
          Bị chặn — chờ lễ tân tiếp tục hoặc phân công lại.
        </p>
      )}
      {task.overdue && <p className="text-danger">Quá hạn</p>}
      {task.instructions && <p className="whitespace-pre-wrap">Hướng dẫn: {task.instructions}</p>}
      {task.blockerHistory?.map((report) => (
        <div key={report.id} className="border-l-2 border-stone-300 pl-3">
          <p className="whitespace-pre-wrap">Lý do không thể xử lý: {report.reason}</p>
          <p>
            Người báo: {report.reportedBy} · {taskDate(report.reportedAt)}
          </p>
          {report.resolvedAt && (
            <p>
              {report.resolution} · {report.resolvedBy} · {taskDate(report.resolvedAt)}
            </p>
          )}
        </div>
      ))}
      {task.continuationHistory?.map((entry, index) => (
        <p key={`${entry.at}:${index}`} className="whitespace-pre-wrap">
          Tiếp tục: {entry.actorId} · {taskDate(entry.at)} · Hạn: {taskDate(entry.dueAt)} ·{' '}
          {entry.instructions}
        </p>
      ))}
      {task.cancellation && (
        <p className="whitespace-pre-wrap">
          Đã hủy do phân công lại: {task.cancellation.reason} · {task.cancellation.actorId} ·{' '}
          {taskDate(task.cancellation.at)}
        </p>
      )}
    </section>
  )
}

export function UnableToResolve({ task, fetching }: { task: AssignedTask; fetching: boolean }) {
  const { me } = useAuth()
  const client = useQueryClient()
  const [reason, setReason] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [validation, setValidation] = useState('')
  const refresh = () =>
    Promise.all([
      client.invalidateQueries({ queryKey: ['assigned-task', me?.id, task.id] }),
      client.invalidateQueries({ queryKey: ['assigned-tasks', me?.id] }),
    ])
  const mutation = useMutation({
    mutationFn: (value: string) => reportUnableToResolve(task.id, value),
    retry: false,
    onSuccess: async (data) => {
      client.setQueryData(['assigned-task', me?.id, task.id], data)
      setConfirmation('')
      setReason('')
      await refresh()
    },
    onError: async () => {
      setConfirmation('')
      await refresh()
    },
  })
  const status = isAxiosError(mutation.error) ? mutation.error.response?.status : undefined
  const eligible =
    (me?.role === 'SERVICE_STAFF' || me?.role === 'OPERATIONS_STAFF') &&
    task.sourceType === 'ISSUE' &&
    task.taskType === 'ISSUE_RESOLUTION' &&
    (task.status === 'ASSIGNED' || task.status === 'IN_PROGRESS')
  if (!eligible) return null
  const busy = mutation.isPending || fetching
  return (
    <section className="space-y-4 border-t border-stone-300 pt-6" aria-label="Báo không thể xử lý">
      <h3 className="font-semibold">Báo không thể xử lý</h3>
      <p>Giữ nguyên tiến độ công việc, không hủy. Lễ tân sẽ xem xét báo cáo.</p>
      {mutation.isSuccess && <p role="status">Đã báo không thể xử lý. Chờ lễ tân xem xét.</p>}
      {mutation.isPending && <p role="status">Đang gửi báo cáo…</p>}
      {mutation.isError && (
        <p role="alert" className="text-danger">
          {status === 403
            ? 'Bạn không có quyền báo cáo công việc này.'
            : status === 404
              ? 'Không tìm thấy công việc.'
              : status === 409
                ? 'Công việc đã thay đổi. Vui lòng kiểm tra trạng thái mới trước khi thử lại.'
                : 'Không thể gửi báo cáo. Vui lòng kiểm tra lý do và thử lại.'}
        </p>
      )}
      <form
        noValidate
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault()
          if (!reason.trim() || reason.trim().length > 2000) {
            setValidation('Vui lòng nhập lý do từ 1 đến 2000 ký tự.')
            return
          }
          setValidation('')
          setConfirmation(reason.trim())
        }}
      >
        <label htmlFor="unable-reason" className="block font-semibold">
          Lý do không thể xử lý (bắt buộc)
        </label>
        <textarea
          id="unable-reason"
          rows={4}
          value={reason}
          required
          disabled={busy || Boolean(confirmation) || status === 403 || status === 404}
          aria-invalid={Boolean(validation)}
          aria-describedby="unable-reason-help"
          onChange={(event) => setReason(event.target.value)}
          className="w-full rounded border border-stone-300 p-3"
        />
        <p id="unable-reason-help">Tối đa 2000 ký tự sau khi bỏ khoảng trắng đầu và cuối.</p>
        {validation && (
          <p role="alert" className="text-danger">
            {validation}
          </p>
        )}
        <Button
          type="submit"
          disabled={busy || Boolean(confirmation) || status === 403 || status === 404}
        >
          Báo không thể xử lý
        </Button>
      </form>
      {confirmation && (
        <section
          role="dialog"
          aria-modal="true"
          aria-label="Xác nhận báo không thể xử lý"
          className="space-y-3 rounded border border-stone-300 p-4"
        >
          <p className="whitespace-pre-wrap">{confirmation}</p>
          <Button
            loading={mutation.isPending}
            disabled={busy}
            onClick={() => mutation.mutate(confirmation)}
          >
            Xác nhận báo cáo
          </Button>
          <Button variant="secondary" disabled={busy} onClick={() => setConfirmation('')}>
            Quay lại
          </Button>
        </section>
      )}
    </section>
  )
}
