import { useRef, useState, type FormEvent } from 'react'
import { isAxiosError } from 'axios'
import { Button } from '@/components/Button'
import { dateTime, executionLabels } from './api'
import type { AssignmentInput, StaffServiceOrder } from './staff-api'
import { useAssignServiceOrder, useServiceAssignees } from './staff-hooks'

export function ServiceAssignment({
  order,
  refreshing,
}: {
  order: StaffServiceOrder
  refreshing: boolean
}) {
  const eligible =
    order.reviewStatus === 'ACCEPTED' && (!order.feeRequired || order.billingStatus === 'BILLED')
  const open = eligible && !order.task && order.executionStatus === 'NOT_STARTED'
  const pending = order.executionStatus === 'ASSIGNING'
  const assignees = useServiceAssignees(
    order.id,
    open || (eligible && pending && !order.task && Boolean(order.assignmentIntent)),
  )
  const mutation = useAssignServiceOrder(order.id)
  const [assigneeId, setAssigneeId] = useState('')
  const [due, setDue] = useState('')
  const [intent, setIntent] = useState<AssignmentInput | null>(null)
  const [confirmation, setConfirmation] = useState<AssignmentInput | null>(null)
  const [validation, setValidation] = useState('')
  const sending = useRef(false)
  const staff = (assignees.data?.items ?? []).filter((item) => item.role === 'SERVICE_STAFF')
  const [recoveryMode, setRecoveryMode] = useState(false)
  const [recoveryReason, setRecoveryReason] = useState('')
  const canRecover =
    eligible &&
    pending &&
    !order.task &&
    Boolean(order.assignmentIntent) &&
    assignees.data?.recoveryAllowed === true
  const editingRecovery = recoveryMode && canRecover && !intent?.recoveryReason
  const activeIntent = intent ?? (pending ? order.assignmentIntent : undefined)
  const disabled = mutation.isPending || refreshing
  function prepare(event: FormEvent) {
    event.preventDefault()
    if (disabled || sending.current || !eligible || order.task || (!open && !pending)) return
    if (editingRecovery) {
      if (
        assignees.isFetching ||
        assignees.isError ||
        !staff.some((item) => item.id === assigneeId) ||
        assigneeId === order.assignmentIntent?.assigneeId ||
        !recoveryReason.trim() ||
        recoveryReason.trim().length > 2000
      ) {
        setValidation('Chọn nhân viên thay thế và nhập lý do khôi phục (tối đa 2000 ký tự).')
        return
      }
      setValidation('')
      setConfirmation({
        assigneeId,
        ...(order.assignmentIntent?.dueAt !== undefined
          ? { dueAt: order.assignmentIntent.dueAt }
          : {}),
        recoveryReason: recoveryReason.trim(),
      })
      return
    }
    if (activeIntent) {
      setConfirmation({ ...activeIntent })
      return
    }
    if (
      !open ||
      assignees.isFetching ||
      assignees.isError ||
      !staff.some((item) => item.id === assigneeId)
    ) {
      setValidation('Vui lòng chọn nhân viên dịch vụ từ danh sách đã tải.')
      return
    }
    const parsed = due ? new Date(due) : undefined
    if (parsed && !Number.isFinite(parsed.getTime())) {
      setValidation('Hạn hoàn thành không hợp lệ.')
      return
    }
    setValidation('')
    setConfirmation({ assigneeId, ...(parsed ? { dueAt: parsed.toISOString() } : {}) })
  }
  async function confirm() {
    if (
      !confirmation ||
      disabled ||
      sending.current ||
      !eligible ||
      order.task ||
      (!open && !pending)
    )
      return
    sending.current = true
    const payload = confirmation
    setIntent(payload)
    setConfirmation(null)
    try {
      await mutation.mutateAsync(payload)
    } catch {
      return
    } finally {
      sending.current = false
    }
  }
  return (
    <section
      className="space-y-4 rounded border border-stone-300 bg-white p-4"
      aria-labelledby="assignment-title"
    >
      <h2 id="assignment-title" className="font-display text-2xl">
        Phân công dịch vụ
      </h2>
      {order.task ? (
        <div className="space-y-2 break-words">
          <p>Công việc liên kết: {order.task.id}</p>
          <p>Nhân viên: {order.task.assigneeId}</p>
          <p>Trạng thái: {executionLabels[order.executionStatus] ?? order.task.status}</p>
          <p>Đã giao: {dateTime(order.task.assignedAt)}</p>
          {order.task.dueAt && <p>Hạn hoàn thành: {dateTime(order.task.dueAt)}</p>}
          {order.task.completedAt && <p>Hoàn thành: {dateTime(order.task.completedAt)}</p>}
        </div>
      ) : !eligible ? (
        <p>Chỉ phân công sau khi đã chấp nhận và hoàn tất ghi phí (nếu có).</p>
      ) : pending && !activeIntent ? (
        <p role="status">
          Đang phân công. Máy chủ chưa cung cấp nội dung phân công đã lưu để khôi phục an toàn. Hãy
          tải lại trạng thái hoặc nhờ nhân viên hỗ trợ; không gửi phân công mới.
        </p>
      ) : open || (pending && activeIntent) ? (
        <form onSubmit={prepare} className="space-y-4">
          {activeIntent && (
            <div role="status" className="space-y-2 break-words">
              <p>Chưa xác nhận kết quả. Nội dung đã gửi được khóa để thử lại an toàn.</p>
              <p>Nhân viên đã lưu: {activeIntent.assigneeId}</p>
              <p>Hạn đã lưu: {activeIntent.dueAt ? dateTime(activeIntent.dueAt) : 'Không có'}</p>
            </div>
          )}
          {canRecover && !intent?.recoveryReason && (
            <label className="block">
              <input
                type="checkbox"
                checked={recoveryMode}
                disabled={disabled || Boolean(confirmation)}
                onChange={(event) => {
                  setRecoveryMode(event.target.checked)
                  setValidation('')
                }}
              />
              Thay nhân viên đã ngừng hoạt động
            </label>
          )}
          {(!activeIntent || editingRecovery) && (
            <>
              {assignees.isPending && <p role="status">Đang tải nhân viên dịch vụ…</p>}
              {assignees.isError && (
                <div role="alert">
                  Không thể tải nhân viên.{' '}
                  <Button type="button" onClick={() => void assignees.refetch()}>
                    Tải lại nhân viên
                  </Button>
                </div>
              )}
              {assignees.isSuccess && staff.length === 0 && (
                <p>Không có nhân viên dịch vụ đang hoạt động.</p>
              )}
              <label className="block">
                Nhân viên dịch vụ
                <select
                  className="min-h-11 w-full rounded border border-stone-300 p-2"
                  value={assigneeId}
                  disabled={disabled || assignees.isFetching || assignees.isError}
                  onChange={(event) => setAssigneeId(event.target.value)}
                >
                  <option value="">Chọn nhân viên</option>
                  {staff.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.displayName}
                    </option>
                  ))}
                </select>
              </label>
              {editingRecovery ? (
                <label className="block">
                  Lý do khôi phục
                  <textarea
                    className="w-full rounded border border-stone-300 p-2"
                    value={recoveryReason}
                    maxLength={2000}
                    disabled={disabled}
                    onChange={(event) => setRecoveryReason(event.target.value)}
                  />
                </label>
              ) : (
                <label className="block">
                  Hạn hoàn thành (không bắt buộc)
                  <input
                    className="min-h-11 w-full rounded border border-stone-300 p-2"
                    type="datetime-local"
                    value={due}
                    disabled={disabled}
                    onChange={(event) => setDue(event.target.value)}
                  />
                </label>
              )}
            </>
          )}
          {validation && <p role="alert">{validation}</p>}
          {mutation.isError && (
            <p role="alert">
              {isAxiosError(mutation.error) && mutation.error.response?.status === 409
                ? 'Phân công đã thay đổi hoặc hoàn tất. Trạng thái đã được tải lại; hãy kiểm tra trước khi thử lại cùng nội dung.'
                : 'Chưa xác nhận được phân công. Tải lại trạng thái hoặc thử lại đúng nội dung đã gửi.'}
            </p>
          )}
          <Button
            type="submit"
            disabled={
              disabled ||
              Boolean(confirmation) ||
              ((!activeIntent || editingRecovery) &&
                (assignees.isFetching ||
                  assignees.isError ||
                  !assigneeId ||
                  !staff.some((item) => item.id === assigneeId)))
            }
          >
            {mutation.isPending
              ? 'Đang phân công…'
              : activeIntent && !editingRecovery
                ? 'Thử lại cùng phân công'
                : 'Xem lại phân công'}
          </Button>
          {confirmation && (
            <div
              role="dialog"
              aria-labelledby="assignment-confirm-title"
              className="space-y-4 rounded border border-primary bg-cream-50 p-4"
            >
              <h3 id="assignment-confirm-title" className="font-display text-2xl">
                Xác nhận phân công
              </h3>
              <p>
                Nhân viên:{' '}
                {staff.find((item) => item.id === confirmation.assigneeId)?.displayName ??
                  confirmation.assigneeId}
              </p>
              <p>
                Hạn hoàn thành: {confirmation.dueAt ? dateTime(confirmation.dueAt) : 'Không có'}
              </p>
              {confirmation.recoveryReason && <p>Lý do khôi phục: {confirmation.recoveryReason}</p>}
              <p>Tạo công việc liên kết cho yêu cầu này, không thay đổi ghi phí.</p>
              <Button type="button" disabled={disabled} onClick={() => void confirm()}>
                Xác nhận phân công
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={disabled}
                onClick={() => setConfirmation(null)}
              >
                Quay lại
              </Button>
            </div>
          )}
        </form>
      ) : (
        <p>Đã phân công, chỉ xem. Tải lại để xem công việc liên kết.</p>
      )}
    </section>
  )
}
