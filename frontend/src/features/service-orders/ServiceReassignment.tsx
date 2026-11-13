import { useRef, useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, NativeSelect, Textarea } from '@/components/atoms'
import { Alert, FormField } from '@/components/molecules'
import { api } from '@/lib/api-client'
import { useAuth } from '@/features/auth/auth-context'
import { useServiceAssignees, staffOrderKeys } from './staff-hooks'
import type { StaffServiceOrder } from './staff-api'

export function ServiceReassignment({
  order,
  refreshing,
}: {
  order: StaffServiceOrder
  refreshing: boolean
}) {
  const { me } = useAuth()
  const client = useQueryClient()
  const eligible =
    order.intakeMode !== 'COMPLETED_ON_SITE' &&
    order.reviewStatus === 'ACCEPTED' &&
    order.executionStatus === 'ASSIGNED' &&
    order.task?.status === 'ASSIGNED' &&
    (!order.feeRequired || order.billingStatus === 'BILLED')
  const candidates = useServiceAssignees(order.id, eligible)
  const [assigneeId, setAssigneeId] = useState('')
  const [reason, setReason] = useState('')
  const [intent, setIntent] = useState<{
    requestId: string
    assigneeId: string
    expectedAssigneeId: string
    reason: string
  } | null>(null)
  const sending = useRef(false)
  const mutation = useMutation({
    mutationFn: async (body: NonNullable<typeof intent>) => {
      if (me?.role !== 'RECEPTIONIST') throw new Error('Không có quyền truy cập')
      return (
        await api.post<StaffServiceOrder>(
          `/service-orders/${encodeURIComponent(order.id)}/reassignment`,
          body,
        )
      ).data
    },
    retry: false,
    onSuccess: (result) => {
      client.setQueryData(staffOrderKeys.detail(me?.id, me?.role, order.id), result)
      setIntent(null)
      setAssigneeId('')
      setReason('')
    },
    onSettled: async () => {
      await Promise.all(
        ['staff-service-orders', 'assigned-tasks', 'service-history', 'service-reports'].map(
          (key) => client.invalidateQueries({ queryKey: [key] }),
        ),
      )
    },
  })
  if (!eligible) return null
  const choices = (candidates.data?.items ?? []).filter(
    (item) => item.role === 'SERVICE_STAFF' && item.id !== order.task?.assigneeId,
  )
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (sending.current || mutation.isPending || refreshing || !eligible) return
    const body = intent ?? {
      requestId: crypto.randomUUID(),
      assigneeId,
      expectedAssigneeId: order.task!.assigneeId,
      reason: reason.trim(),
    }
    if (
      !intent &&
      (!choices.some((item) => item.id === assigneeId) || !body.reason || body.reason.length > 2000)
    )
      return
    setIntent(body)
    sending.current = true
    try {
      await mutation.mutateAsync(body)
    } catch {
      return
    } finally {
      sending.current = false
    }
  }
  return (
    <form
      onSubmit={(event) => void submit(event)}
      className="space-y-4 border-t border-border pt-4"
    >
      <h3 className="text-sm font-semibold">Đổi phân công trước khi thực hiện</h3>
      {candidates.isPending && <p role="status">Đang tải nhân viên…</p>}
      {candidates.isError && (
        <Alert tone="danger">
          Không thể tải nhân viên.{' '}
          <Button type="button" onClick={() => void candidates.refetch()}>
            Tải lại nhân viên
          </Button>
        </Alert>
      )}
      {candidates.isSuccess && !choices.length && <p>Không có nhân viên thay thế.</p>}
      <FormField label="Nhân viên thay thế" htmlFor="reassignment-assignee">
        <NativeSelect
          id="reassignment-assignee"
          required
          disabled={Boolean(intent) || mutation.isPending || refreshing}
          value={assigneeId}
          onChange={(event) => setAssigneeId(event.target.value)}
        >
          <option value="">Chọn nhân viên</option>
          {choices.map((item) => (
            <option key={item.id} value={item.id}>
              {item.displayName}
            </option>
          ))}
        </NativeSelect>
      </FormField>
      <FormField label="Lý do đổi phân công" htmlFor="reassignment-reason">
        <Textarea
          id="reassignment-reason"
          required
          maxLength={2000}
          value={reason}
          disabled={Boolean(intent) || mutation.isPending || refreshing}
          onChange={(event) => setReason(event.target.value)}
        />
      </FormField>
      {mutation.isError && (
        <Alert tone="danger">
          Chưa xác nhận đổi phân công. Trạng thái đã được tải lại; kiểm tra trước khi thử lại cùng
          nội dung.
        </Alert>
      )}
      <Button
        type="submit"
        className="rounded-full"
        disabled={
          mutation.isPending ||
          refreshing ||
          (!intent &&
            (candidates.isFetching || candidates.isError || !assigneeId || !reason.trim()))
        }
      >
        {intent ? 'Thử lại đổi phân công' : 'Đổi phân công'}
      </Button>
    </form>
  )
}
