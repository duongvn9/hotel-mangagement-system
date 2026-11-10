import { useState, type FormEvent } from 'react'
import { Button, Input, NativeSelect } from '@/components/atoms'
import { Alert, FormField } from '@/components/molecules'
import { getErrorMessage } from '@/lib/api-client'
import { useCheckoutInspection, useInspectors, useRequestInspection } from '../hooks'

/**
 * Lễ tân nhờ nhân viên dịch vụ kiểm tra dịch vụ đã dùng và hư hỏng trước khi lập hóa đơn cuối.
 * Việc hiện trong danh sách công việc của nhân viên; kết quả hiện lại ở đây để lễ tân ghi phí.
 */
export function CheckoutInspection({ bookingId }: { bookingId: string }) {
  const inspection = useCheckoutInspection(bookingId)
  const current = inspection.data
  // Chưa từng yêu cầu hoặc lần trước đã bị hủy thì cho yêu cầu mới.
  const canRequest = inspection.isSuccess && (current === null || current?.status === 'CANCELLED')
  const inspectors = useInspectors(canRequest)
  const request = useRequestInspection(bookingId)
  const [assigneeId, setAssigneeId] = useState('')
  const [note, setNote] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!assigneeId) return
    try {
      await request.mutateAsync({ assigneeId, ...(note.trim() ? { note: note.trim() } : {}) })
      setAssigneeId('')
      setNote('')
    } catch {
      // Lỗi hiển thị qua request.error; giữ nội dung để thử lại.
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-border bg-surface p-4">
      <h4 className="text-sm font-semibold text-foreground">Kiểm tra phòng</h4>
      {inspection.isError && (
        <p className="text-sm text-muted-foreground">Không tải được trạng thái kiểm tra phòng.</p>
      )}

      {canRequest && (
        <form onSubmit={submit} className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Nhờ nhân viên dịch vụ kiểm tra dịch vụ khách đã dùng và hư hỏng trước khi lập hóa đơn.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Nhân viên kiểm tra" htmlFor={`inspector-${bookingId}`}>
              <NativeSelect
                id={`inspector-${bookingId}`}
                value={assigneeId}
                onChange={(event) => setAssigneeId(event.target.value)}
              >
                <option value="">Chọn nhân viên</option>
                {(inspectors.data ?? []).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.fullName}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField label="Ghi chú cho người kiểm tra" htmlFor={`inspector-note-${bookingId}`}>
              <Input
                id={`inspector-note-${bookingId}`}
                maxLength={500}
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            </FormField>
          </div>
          {inspectors.isError && (
            <p className="text-sm text-muted-foreground">Không tải được danh sách nhân viên.</p>
          )}
          <div className="flex justify-end">
            <Button
              type="submit"
              size="sm"
              disabled={!assigneeId || request.isPending}
              className="rounded-full"
            >
              Yêu cầu kiểm tra phòng
            </Button>
          </div>
          {request.isError && <Alert tone="danger">{getErrorMessage(request.error)}</Alert>}
        </form>
      )}

      {current && (current.status === 'ASSIGNED' || current.status === 'IN_PROGRESS') && (
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>Đang chờ {current.assigneeName} kiểm tra.</span>
          <Button
            size="sm"
            variant="ghost"
            className="rounded-full"
            disabled={inspection.isFetching}
            onClick={() => void inspection.refetch()}
          >
            Tải lại
          </Button>
        </div>
      )}

      {current?.status === 'COMPLETED' && (
        <div className="space-y-2 text-sm">
          <p className="font-semibold text-success">{current.assigneeName} đã kiểm tra xong.</p>
          {current.workResult && (
            <div className="rounded-lg border border-border bg-card p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Kết quả kiểm tra
              </p>
              <p className="mt-1 whitespace-pre-wrap text-foreground">{current.workResult}</p>
            </div>
          )}
          <p className="text-muted-foreground">Ghi các khoản phí tương ứng ở bên dưới.</p>
        </div>
      )}
    </div>
  )
}
