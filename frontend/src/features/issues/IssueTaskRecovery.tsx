import { useState } from 'react'
import { isAxiosError } from 'axios'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/Button'
import { ConfirmationDialog } from '@/components/ConfirmationDialog'
import { SelectField } from '@/components/SelectField'
import { TextField } from '@/components/TextField'
import { useAuth } from '@/features/auth/auth-context'
import { ResolutionHistory } from '@/features/tasks/TaskResolution'
import {
  continueIssue,
  getIssueAssignees,
  getIssue,
  reassignIssue,
  type ContinueIssueInput,
  type IssueDetail,
  type ReassignIssueInput,
} from './api'
import { issueKeys } from './hooks'
import { issueDate } from './presentation'

type Action =
  { kind: 'continue'; input: ContinueIssueInput } | { kind: 'reassign'; input: ReassignIssueInput }

export function IssueTaskRecovery({ issue }: { issue: IssueDetail }) {
  const { me } = useAuth()
  const client = useQueryClient()
  const [assigneeId, setAssigneeId] = useState('')
  const [reason, setReason] = useState('')
  const [due, setDue] = useState('')
  const [instructions, setInstructions] = useState('')
  const [validation, setValidation] = useState('')
  const [confirmation, setConfirmation] = useState<Action>()
  const [confirmationTrigger, setConfirmationTrigger] = useState<HTMLElement | null>(null)
  const [retryIntent, setRetryIntent] = useState<ReassignIssueInput>()
  const pending = issue.pendingReassignment
  const current = issue.linkedTasks[0]
  const history = issue.resolutionTasks ?? issue.linkedTasks
  const currentDetail = history.find((task) => task.id === current?.id) ?? current
  const actionable =
    issue.status === 'ASSIGNED' &&
    currentDetail &&
    (currentDetail.status === 'ASSIGNED' || currentDetail.status === 'IN_PROGRESS') &&
    (currentDetail.blocked || currentDetail.overdue)
  const receptionist = me?.role === 'RECEPTIONIST'
  const assignees = useQuery({
    queryKey: [
      ...issueKeys.scope(me?.id, me?.role),
      'reassignment-assignees',
      issue.id,
      pending?.requestId,
    ],
    queryFn: () => getIssueAssignees(issue.id),
    enabled: receptionist && Boolean(actionable || pending),
    retry: false,
  })
  const expectedRole =
    issue.handlingCategory === 'SERVICE'
      ? 'SERVICE_STAFF'
      : issue.handlingCategory === 'OPERATIONS'
        ? 'OPERATIONS_STAFF'
        : undefined
  const users = (assignees.data?.items ?? []).filter(
    (user) =>
      user.role === expectedRole &&
      user.id !== current?.assigneeId &&
      user.id !== history.find((task) => task.id === pending?.taskId)?.assigneeId,
  )
  const pendingEligible =
    assignees.isSuccess && users.some((user) => user.id === pending?.assigneeId)
  const replacementAllowed = Boolean(
    pending &&
    assignees.isSuccess &&
    !pendingEligible &&
    issue.resolutionTasks &&
    !issue.resolutionTasks.some((task) => task.id === pending.targetTaskId),
  )
  const refresh = () => client.invalidateQueries({ queryKey: issueKeys.scope(me?.id, me?.role) })
  async function reloadIntent() {
    try {
      const fresh = await client.fetchQuery({
        queryKey: issueKeys.detail(me?.id, me?.role, issue.id),
        queryFn: () => getIssue(issue.id),
        staleTime: 0,
        retry: false,
      })
      if (fresh.id === issue.id && Array.isArray(fresh.linkedTasks)) {
        setRetryIntent((saved) =>
          saved && fresh.pendingReassignment?.requestId === saved.requestId ? saved : undefined,
        )
      }
    } catch {
      return
    }
  }
  const mutation = useMutation({
    mutationFn: (action: Action) =>
      action.kind === 'continue'
        ? continueIssue(issue.id, action.input)
        : reassignIssue(issue.id, action.input),
    retry: false,
    onSuccess: async (data) => {
      client.setQueryData(issueKeys.detail(me?.id, me?.role, issue.id), data)
      setRetryIntent(undefined)
      setConfirmation(undefined)
      setValidation('')
      await Promise.all([refresh(), client.invalidateQueries({ queryKey: ['task-queues'] })])
    },
    onError: async () => {
      setConfirmation(undefined)
      await Promise.all([reloadIntent(), assignees.refetch()])
    },
  })
  const status = isAxiosError(mutation.error) ? mutation.error.response?.status : undefined
  const busy =
    mutation.isPending ||
    client.isFetching({ queryKey: issueKeys.detail(me?.id, me?.role, issue.id) }) > 0
  function prepare(kind: Action['kind'], replaceTarget = false) {
    setValidation('')
    if (kind === 'reassign' && (pending || retryIntent)) {
      const saved = pending ?? retryIntent!
      const target = replaceTarget ? assigneeId : saved.assigneeId
      if (replaceTarget && (!replacementAllowed || !users.some((user) => user.id === target))) {
        setValidation('Chọn nhân viên phù hợp để khôi phục ý định đang chờ.')
        return
      }
      const input: ReassignIssueInput = {
        taskId: saved.taskId,
        assigneeId: target,
        reason: saved.reason,
        requestId: saved.requestId,
        ...(saved.dueAt ? { dueAt: saved.dueAt } : {}),
      }
      setRetryIntent(input)
      setConfirmation({ kind, input })
      return
    }
    if (
      !current ||
      (due && !Number.isFinite(new Date(due).getTime())) ||
      instructions.trim().length > 2000
    ) {
      setValidation('Thời hạn phải hợp lệ; hướng dẫn tối đa 2000 ký tự.')
      return
    }
    const deadline = due ? { dueAt: new Date(due).toISOString() } : {}
    if (kind === 'continue') {
      setConfirmation({
        kind,
        input: {
          taskId: current.id,
          ...deadline,
          ...(instructions.trim() ? { instructions: instructions.trim() } : {}),
        },
      })
    } else {
      if (
        !assignees.isSuccess ||
        !users.some((user) => user.id === assigneeId) ||
        !reason.trim() ||
        reason.trim().length > 2000
      ) {
        setValidation('Chọn nhân viên khác phù hợp và nhập lý do từ 1 đến 2000 ký tự.')
        return
      }
      const input = {
        taskId: current.id,
        assigneeId,
        reason: reason.trim(),
        requestId: crypto.randomUUID(),
        ...deadline,
      }
      setConfirmation({ kind, input })
    }
  }
  if (me?.role !== 'RECEPTIONIST' && me?.role !== 'MANAGER') return null
  return (
    <section className="space-y-4" aria-label="Theo dõi xử lý sự cố">
      <h3 className="font-semibold">Công việc xử lý hiện tại và lịch sử</h3>
      {current && (
        <p>
          Công việc hiện tại: {current.title} · {current.id} · {current.assigneeId} ·{' '}
          {current.status}
        </p>
      )}
      {history.map((task) => (
        <article key={task.id} className="space-y-2 rounded border border-stone-300 p-4">
          <h4 className="font-semibold">
            {task.title} · {task.id}
          </h4>
          <p>
            Nhân viên: {task.assigneeId} · Trạng thái: {task.status}
          </p>
          <p>
            Ngày giao: {issueDate(task.assignedAt)} · Thời hạn:{' '}
            {task.dueAt == null ? 'Không có thời hạn' : issueDate(task.dueAt)}
          </p>
          {task.completedAt && <p>Hoàn tất: {issueDate(task.completedAt)}</p>}
          {'workResult' in task && typeof task.workResult === 'string' && (
            <p className="whitespace-pre-wrap">Kết quả: {task.workResult}</p>
          )}
          <ResolutionHistory task={task} />
        </article>
      ))}
      {pending && (
        <div role="status" className="space-y-2 rounded border border-warning p-4">
          <p>
            Phân công lại đang chờ khôi phục. Bất kỳ lễ tân nào cũng có thể tiếp tục cùng yêu cầu.
          </p>
          <p>
            Mã yêu cầu: {pending.requestId} · Nhân viên đích: {pending.assigneeId}
          </p>
          <p className="whitespace-pre-wrap">Lý do: {pending.reason}</p>
          <p>
            Thời hạn: {pending.dueAt == null ? 'Không có thời hạn' : issueDate(pending.dueAt)} ·
            Người yêu cầu: {pending.actorId}
          </p>
        </div>
      )}
      {mutation.isSuccess && <p role="status">Đã cập nhật xử lý sự cố.</p>}
      {mutation.isError && (
        <p role="alert" className="text-danger">
          {status === 403
            ? 'Bạn không có quyền thực hiện thao tác này.'
            : status === 404
              ? 'Không tìm thấy sự cố hoặc công việc.'
              : status === 400
                ? 'Dữ liệu không hợp lệ hoặc nhân viên không còn phù hợp.'
                : status === 409
                  ? 'Trạng thái hoặc ý định đã thay đổi. Đã tải lại; kiểm tra trước khi khôi phục.'
                  : 'Chưa thể hoàn tất. Đã tải lại trạng thái; thử lại cùng mã yêu cầu để khôi phục.'}
        </p>
      )}
      {receptionist && Boolean(actionable || pending || retryIntent) && (
        <>
          {validation && (
            <p role="alert" className="text-danger">
              {validation}
            </p>
          )}
          {assignees.isPending && <p role="status">Đang tải nhân viên phù hợp…</p>}
          {assignees.isError && (
            <div role="alert">
              <p>Không thể tải nhân viên phù hợp.</p>
              <Button onClick={() => void assignees.refetch()}>Tải lại nhân viên</Button>
            </div>
          )}
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => void Promise.all([reloadIntent(), assignees.refetch()])}
          >
            Tải lại trạng thái xử lý
          </Button>
          <fieldset
            disabled={busy || Boolean(confirmation) || status === 403 || status === 404}
            className="space-y-4"
          >
            {!pending && !retryIntent && (
              <>
                <TextField
                  label="Thời hạn mới (không bắt buộc)"
                  type="datetime-local"
                  value={due}
                  onChange={(event) => setDue(event.target.value)}
                />
                <p className="text-sm">
                  Giờ địa phương của thiết bị; được chuyển sang ISO UTC khi gửi.
                </p>
                <TextField
                  label="Hướng dẫn tiếp tục (không bắt buộc)"
                  value={instructions}
                  onChange={(event) => setInstructions(event.target.value)}
                />
                <Button
                  onClick={(event) => {
                    setConfirmationTrigger(event.currentTarget)
                    prepare('continue')
                  }}
                >
                  Tiếp tục xử lý
                </Button>
              </>
            )}
            {((!pending && !retryIntent) || replacementAllowed) && (
              <>
                <SelectField
                  label="Nhân viên thay thế"
                  value={assigneeId}
                  options={[
                    { value: '', label: 'Chọn nhân viên khác' },
                    ...users.map((user) => ({ value: user.id, label: user.displayName })),
                  ]}
                  onChange={(event) => setAssigneeId(event.target.value)}
                />
                {assignees.isSuccess && !users.length && (
                  <p role="status">Không có nhân viên khác phù hợp đang hoạt động.</p>
                )}
              </>
            )}
            {replacementAllowed && (
              <>
                <p>
                  Nhân viên đích không còn phù hợp và chưa có công việc đích trong lịch sử. Có thể
                  chọn nhân viên khác; máy chủ kiểm tra lại trước khi thay thế.
                </p>
                <Button
                  onClick={(event) => {
                    setConfirmationTrigger(event.currentTarget)
                    prepare('reassign', true)
                  }}
                >
                  Khôi phục với nhân viên thay thế
                </Button>
              </>
            )}
            {!pending && !retryIntent && (
              <TextField
                label="Lý do phân công lại (bắt buộc)"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            )}
            <Button
              onClick={(event) => {
                setConfirmationTrigger(event.currentTarget)
                prepare('reassign')
              }}
            >
              {pending || retryIntent ? 'Khôi phục phân công lại' : 'Phân công lại'}
            </Button>
          </fieldset>
        </>
      )}
      {receptionist && confirmation && (
        <ConfirmationDialog
          label="Xác nhận xử lý công việc"
          returnFocus={confirmationTrigger}
          busy={busy}
          onCancel={() => setConfirmation(undefined)}
        >
          <p>
            {confirmation.kind === 'continue'
              ? 'Tiếp tục cùng công việc, nhân viên và tiến độ.'
              : 'Phân công cho nhân viên khác; công việc cũ được giữ trong lịch sử.'}
          </p>
          <p>
            Thời hạn:{' '}
            {confirmation.input.dueAt == null
              ? 'Không có thời hạn'
              : issueDate(confirmation.input.dueAt)}
          </p>
          <p className="whitespace-pre-wrap">
            {confirmation.kind === 'reassign'
              ? `${confirmation.input.assigneeId} · ${confirmation.input.reason}`
              : confirmation.input.instructions}
          </p>
          <Button
            loading={mutation.isPending}
            disabled={busy}
            onClick={() => {
              if (confirmation.kind === 'reassign') setRetryIntent(confirmation.input)
              mutation.mutate(confirmation)
            }}
          >
            Xác nhận xử lý công việc
          </Button>
          <Button variant="secondary" disabled={busy} onClick={() => setConfirmation(undefined)}>
            Quay lại
          </Button>
        </ConfirmationDialog>
      )}
      {mutation.isPending && <p role="status">Đang cập nhật xử lý…</p>}
    </section>
  )
}
