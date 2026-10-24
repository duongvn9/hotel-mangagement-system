import { useState } from 'react'
import { isAxiosError } from 'axios'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/Button'
import { SelectField } from '@/components/SelectField'
import { TextField } from '@/components/TextField'
import { useAuth } from '@/features/auth/auth-context'
import {
  assignIssue,
  getIssueAssignees,
  issuePriorities,
  reviewIssue,
  type AssignmentInput,
  type HandlingCategory,
  type IssueDetail,
  type IssuePriority,
  type ReviewIssueInput,
} from './api'
import { issueKeys } from './hooks'
import { handlingLabels, issueDate, priorityLabels, staffRoleLabels } from './presentation'

function mutationError(error: unknown) {
  const status = isAxiosError(error) ? error.response?.status : undefined
  if (status === 400)
    return 'Thông tin không hợp lệ hoặc nhân viên không còn phù hợp. Vui lòng kiểm tra lại.'
  if (status === 403) return 'Bạn không có quyền thực hiện thao tác này.'
  if (status === 404) return 'Không tìm thấy sự cố trong phạm vi truy cập của bạn.'
  if (status === 409)
    return 'Sự cố đã thay đổi hoặc có ý định phân công khác. Đã yêu cầu tải lại trạng thái; chỉ thử lại đúng ý định đang lưu.'
  return 'Không thể hoàn tất thao tác. Đã yêu cầu tải lại trạng thái; kiểm tra ý định đang lưu trước khi thử lại.'
}

export function IssueHandling({ issue }: { issue: IssueDetail }) {
  const { me } = useAuth()
  const client = useQueryClient()
  const [category, setCategory] = useState<HandlingCategory | ''>('')
  const [priority, setPriority] = useState<IssuePriority>(issue.priority)
  const [needsStaffAction, setNeedsStaffAction] = useState(false)
  const [notes, setNotes] = useState('')
  const [assigneeId, setAssigneeId] = useState('')
  const [due, setDue] = useState('')
  const [error, setError] = useState('')
  const [confirmation, setConfirmation] = useState<
    { kind: 'review'; input: ReviewIssueInput } | { kind: 'assignment'; input: AssignmentInput }
  >()
  const eligible =
    me?.role === 'RECEPTIONIST' &&
    issue.needsStaffAction === true &&
    (issue.status === 'REVIEWED' || issue.status === 'ASSIGNING')
  const recovering = issue.status === 'ASSIGNING'
  const assignees = useQuery({
    queryKey: [
      ...issueKeys.scope(me?.id, me?.role),
      'assignees',
      issue.id,
      issue.handlingCategory,
      issue.status,
    ],
    queryFn: () => getIssueAssignees(issue.id),
    enabled: eligible,
    retry: false,
  })
  const expectedRole =
    issue.handlingCategory === 'SERVICE'
      ? 'SERVICE_STAFF'
      : issue.handlingCategory === 'OPERATIONS'
        ? 'OPERATIONS_STAFF'
        : undefined
  const users = (assignees.data?.items ?? []).filter(
    (user) => expectedRole && user.role === expectedRole,
  )
  const refresh = () => client.invalidateQueries({ queryKey: issueKeys.scope(me?.id, me?.role) })
  const mutation = useMutation({
    mutationFn: (value: NonNullable<typeof confirmation>) =>
      value.kind === 'review'
        ? reviewIssue(issue.id, value.input)
        : assignIssue(issue.id, value.input),
    retry: false,
    onSuccess: async (data) => {
      client.setQueryData(issueKeys.detail(me?.id, me?.role, issue.id), data)
      setConfirmation(undefined)
      setError('')
      await refresh()
    },
    onError: async (cause) => {
      setConfirmation(undefined)
      setError(mutationError(cause))
      await refresh()
    },
  })
  if (me?.role !== 'RECEPTIONIST') return null
  const review = () => {
    setError('')
    if (!category || !issuePriorities.includes(priority) || notes.trim().length > 2000) {
      setError('Vui lòng chọn nhóm xử lý, mức ưu tiên và ghi chú tối đa 2000 ký tự.')
      return
    }
    setConfirmation({
      kind: 'review',
      input: {
        handlingCategory: category,
        priority,
        needsStaffAction,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      },
    })
  }
  const assignment = () => {
    setError('')
    if (recovering) {
      if (!issue.assigneeId || (issue.dueAt && !Number.isFinite(new Date(issue.dueAt).getTime()))) {
        setError('Ý định phân công chưa đầy đủ. Hãy tải lại chi tiết; không thể tạo ý định khác.')
        return
      }
      setConfirmation({
        kind: 'assignment',
        input: { assigneeId: issue.assigneeId, ...(issue.dueAt ? { dueAt: issue.dueAt } : {}) },
      })
      return
    }
    if (
      !users.some((user) => user.id === assigneeId) ||
      (due && !Number.isFinite(new Date(due).getTime()))
    ) {
      setError('Vui lòng chọn nhân viên trong danh sách và thời hạn hợp lệ.')
      return
    }
    setConfirmation({
      kind: 'assignment',
      input: { assigneeId, ...(due ? { dueAt: new Date(due).toISOString() } : {}) },
    })
  }
  return (
    <section className="space-y-4" aria-label="Xử lý sự cố">
      {error && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}
      <fieldset
        disabled={mutation.isPending || Boolean(confirmation)}
        className="space-y-4 disabled:opacity-70"
      >
        {issue.status === 'PENDING_REVIEW' && (
          <>
            <h3 className="font-semibold">Xem xét sự cố</h3>
            <SelectField
              label="Nhóm xử lý"
              value={category}
              options={[
                { value: '', label: 'Chọn nhóm xử lý' },
                ...Object.entries(handlingLabels).map(([value, label]) => ({ value, label })),
              ]}
              onChange={(event) => setCategory(event.target.value as HandlingCategory)}
            />
            <SelectField
              label="Ưu tiên xử lý"
              value={priority}
              options={issuePriorities.map((value) => ({ value, label: priorityLabels[value] }))}
              onChange={(event) => setPriority(event.target.value as IssuePriority)}
            />
            <label className="flex min-h-11 items-center gap-3">
              <input
                type="checkbox"
                checked={needsStaffAction}
                onChange={(event) => setNeedsStaffAction(event.target.checked)}
              />
              Cần nhân viên xử lý
            </label>
            <TextField
              label="Ghi chú xem xét"
              value={notes}
              maxLength={2000}
              onChange={(event) => setNotes(event.target.value)}
            />
            <p className="text-sm text-stone-700">
              Không cần nhân viên: kết luận sự cố, không tạo công việc.
            </p>
            <Button onClick={review}>Xem xét</Button>
          </>
        )}
        {eligible && (
          <>
            <h3 className="font-semibold">Phân công xử lý</h3>
            {recovering ? (
              <>
                <p role="status">
                  Phân công chưa hoàn tất. Chỉ thử lại cùng nhân viên và thời hạn đã lưu; không thay
                  đổi ý định.
                </p>
                <p>Nhân viên đã lưu: {issue.assigneeId ?? 'Chưa có thông tin'}</p>
                <p>Thời hạn đã lưu: {issue.dueAt ? issueDate(issue.dueAt) : 'Không có'}</p>
                <Button onClick={assignment} disabled={!issue.assigneeId}>
                  Thử lại phân công
                </Button>
              </>
            ) : (
              <>
                {assignees.isPending ? (
                  <p role="status">Đang tải nhân viên…</p>
                ) : assignees.isError ? (
                  <div role="alert">
                    <p>Không thể tải nhân viên. {mutationError(assignees.error)}</p>
                    <Button variant="secondary" onClick={() => void assignees.refetch()}>
                      Tải lại nhân viên
                    </Button>
                    <Button variant="secondary" onClick={() => void refresh()}>
                      Tải lại chi tiết
                    </Button>
                  </div>
                ) : users.length === 0 ? (
                  <p role="status">Không có nhân viên phù hợp đang hoạt động.</p>
                ) : (
                  <SelectField
                    label="Nhân viên xử lý"
                    value={assigneeId}
                    options={[
                      { value: '', label: 'Chọn nhân viên' },
                      ...users.map((user) => ({
                        value: user.id,
                        label: `${user.displayName} — ${staffRoleLabels[user.role]}`,
                      })),
                    ]}
                    onChange={(event) => setAssigneeId(event.target.value)}
                  />
                )}
                <TextField
                  label="Thời hạn xử lý"
                  type="datetime-local"
                  value={due}
                  onChange={(event) => setDue(event.target.value)}
                />
                <p className="text-sm text-stone-700">
                  Giờ địa phương của thiết bị ({Intl.DateTimeFormat().resolvedOptions().timeZone});
                  được chuyển sang ISO UTC khi gửi. Thời hạn không bắt buộc.
                </p>
                <Button onClick={assignment} disabled={!assignees.isSuccess || users.length === 0}>
                  Phân công
                </Button>
              </>
            )}
          </>
        )}
      </fieldset>
      {confirmation && (
        <section
          role="dialog"
          aria-modal="true"
          aria-label="Xác nhận xử lý sự cố"
          className="space-y-4 rounded-lg border border-stone-300 bg-cream-50 p-4"
        >
          <h3 className="font-semibold">Xác nhận xử lý sự cố</h3>
          {confirmation.kind === 'review' ? (
            <>
              <p>
                {handlingLabels[confirmation.input.handlingCategory]} ·{' '}
                {priorityLabels[confirmation.input.priority]} ·{' '}
                {confirmation.input.needsStaffAction
                  ? 'Cần nhân viên xử lý'
                  : 'Kết luận, không tạo công việc'}
              </p>
              <p className="break-words whitespace-pre-wrap">{confirmation.input.notes}</p>
            </>
          ) : (
            <>
              <p>
                Nhân viên:{' '}
                {users.find((user) => user.id === confirmation.input.assigneeId)?.displayName ??
                  confirmation.input.assigneeId}
              </p>
              <p>
                Thời hạn:{' '}
                {confirmation.input.dueAt ? issueDate(confirmation.input.dueAt) : 'Không có'}
              </p>
            </>
          )}
          <Button disabled={mutation.isPending} onClick={() => mutation.mutate(confirmation)}>
            Xác nhận
          </Button>
          <Button
            variant="secondary"
            disabled={mutation.isPending}
            onClick={() => setConfirmation(undefined)}
          >
            Hủy
          </Button>
        </section>
      )}
      {mutation.isPending && <p role="status">Đang lưu và cập nhật trạng thái…</p>}
    </section>
  )
}
