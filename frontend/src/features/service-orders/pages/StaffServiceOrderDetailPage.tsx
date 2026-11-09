import { useRef, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router'
import { Button, NativeSelect, Skeleton, Textarea } from '@/components/atoms'
import { FormField } from '@/components/molecules'
import { ConfirmationDialog, PageContainer, PageHeader, Panel } from '@/components/organisms'
import { useAuth } from '@/features/auth/auth-context'
import { OrderReceipt } from '../presentation'
import { dateTime, money } from '../api'
import { useReviewStaffOrder, useStaffOrder } from '../staff-hooks'
import { billingLabel, type ReviewInput, type StaffServiceOrder } from '../staff-api'
import { StaffOrderError } from '../staff-presentation'
import { ServiceAssignment } from '../ServiceAssignment'

function ReviewForm({ order, refreshing }: { order: StaffServiceOrder; refreshing: boolean }) {
  const mutation = useReviewStaffOrder(order.id)
  const [decision, setDecision] = useState<ReviewInput['decision']>('ACCEPT')
  const [reason, setReason] = useState('')
  const [intent, setIntent] = useState<ReviewInput | null>(null)
  const [confirmation, setConfirmation] = useState<ReviewInput | null>(null)
  const [validation, setValidation] = useState('')
  const sending = useRef(false)
  const accepting = order.reviewStatus === 'ACCEPTING'
  const persisted: ReviewInput | null =
    accepting && order.review?.decision === 'ACCEPT'
      ? {
          decision: 'ACCEPT',
          ...(order.review.reason !== undefined ? { reason: order.review.reason } : {}),
        }
      : null
  const locked = accepting || Boolean(intent)
  const activeIntent = accepting ? persisted : intent
  const final = order.reviewStatus === 'ACCEPTED' || order.reviewStatus === 'REJECTED'
  const disabled = mutation.isPending || refreshing
  function prepare(event: FormEvent) {
    event.preventDefault()
    if (disabled || sending.current || final) return
    const next = activeIntent ?? { decision, ...(reason.trim() ? { reason: reason.trim() } : {}) }
    if (accepting && !persisted) {
      setValidation('Chưa có nội dung duyệt đã lưu. Vui lòng tải lại trạng thái.')
      return
    }
    if ((next.reason?.length ?? 0) > 2000 || (next.decision === 'REJECT' && !next.reason?.trim())) {
      setValidation('Lý do từ chối là bắt buộc và lý do tối đa 2000 ký tự.')
      return
    }
    setValidation('')
    setConfirmation(next)
  }
  async function confirm() {
    if (!confirmation || disabled || sending.current || final) return
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
  if (final) return <p role="status">Kết quả duyệt đã hoàn tất, chỉ xem.</p>
  return (
    <Panel title="Duyệt yêu cầu">
      <form onSubmit={prepare} className="space-y-4 text-sm">
        {accepting && (
          <p role="status">
            Đang chấp nhận, chờ hoàn tất ghi phí. Chỉ được thử lại quyết định ACCEPT và lý do đã
            lưu, không thể sửa.
          </p>
        )}
        {intent && !accepting && (
          <p role="status">Chưa xác nhận kết quả. Nội dung đã gửi được khóa để thử lại an toàn.</p>
        )}
        <FormField label="Quyết định" htmlFor="review-decision">
          <NativeSelect
            id="review-decision"
            value={activeIntent?.decision ?? decision}
            disabled={locked || disabled}
            onChange={(event) => setDecision(event.target.value as ReviewInput['decision'])}
          >
            <option value="ACCEPT">Chấp nhận</option>
            <option value="REJECT">Từ chối</option>
          </NativeSelect>
        </FormField>
        <FormField label="Lý do (bắt buộc khi từ chối, tối đa 2000 ký tự)" htmlFor="review-reason">
          <Textarea
            id="review-reason"
            className="min-h-28"
            maxLength={2000}
            value={activeIntent?.reason ?? (locked ? '' : reason)}
            disabled={locked || disabled}
            onChange={(event) => setReason(event.target.value)}
          />
        </FormField>
        {validation && (
          <p role="alert" className="text-danger">
            {validation}
          </p>
        )}
        {mutation.isError && <StaffOrderError error={mutation.error} presentation="workspace" />}
        <Button
          type="submit"
          disabled={disabled || Boolean(confirmation) || (accepting && !persisted)}
        >
          {mutation.isPending
            ? 'Đang xử lý…'
            : locked
              ? 'Thử lại cùng nội dung'
              : 'Xem lại quyết định'}
        </Button>
        {confirmation && (
          <ConfirmationDialog
            label={`Xác nhận ${confirmation.decision === 'ACCEPT' ? 'chấp nhận' : 'từ chối'}`}
            busy={disabled}
            returnFocus={document.activeElement as HTMLElement}
            onCancel={() => setConfirmation(null)}
          >
            <h3 id="review-confirm-title" className="text-sm font-semibold">
              Xác nhận {confirmation.decision === 'ACCEPT' ? 'chấp nhận' : 'từ chối'}
            </h3>
            {confirmation.decision === 'REJECT' ? (
              <p>Từ chối yêu cầu, không ghi phí và không tạo công việc.</p>
            ) : (
              <p>
                {order.feeRequired
                  ? `Phí ước tính theo dữ liệu ghi nhận: ${money(order.amount)}. Khi hoàn tất, khoản phí được thêm vào hóa đơn, không phải thanh toán.`
                  : 'Dịch vụ không tính phí, không ghi phí vào hóa đơn.'}{' '}
                Chưa phân công công việc ở bước này.
              </p>
            )}
            <p className="whitespace-pre-wrap break-words">
              Lý do: {confirmation.reason || 'Không có'}
            </p>
            <div className="flex flex-wrap gap-4">
              <Button type="button" disabled={disabled} onClick={() => void confirm()}>
                Xác nhận gửi
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
          </ConfirmationDialog>
        )}
      </form>
    </Panel>
  )
}
export function StaffServiceOrderDetailPage() {
  const { id = '' } = useParams()
  const { me } = useAuth()
  const order = useStaffOrder(id)
  return (
    <PageContainer className="space-y-6">
      <Link
        className="inline-flex min-h-11 items-center rounded-sm text-primary underline transition-colors hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        to="/staff/service-orders"
      >
        Yêu cầu dịch vụ
      </Link>
      <PageHeader
        title="Chi tiết yêu cầu dịch vụ"
        actions={
          <Button
            variant="outline"
            className="rounded-full"
            disabled={order.isFetching}
            onClick={() => void order.refetch()}
          >
            Tải lại trạng thái
          </Button>
        }
      />
      {order.isPending && (
        <div role="status" className="space-y-3">
          <p className="text-sm text-muted-foreground">Đang tải yêu cầu dịch vụ…</p>
          <Skeleton className="h-48 w-full" />
        </div>
      )}
      {order.isError && (
        <StaffOrderError
          error={order.error}
          retry={() => void order.refetch()}
          presentation="workspace"
        />
      )}
      {order.data && (
        <>
          <Panel title="Khách hàng và đặt phòng" className="min-w-0 break-words">
            <div className="space-y-2 text-sm">
              <p>
                Khách hàng: {order.data.customer.fullName ?? 'Không có tên'} ·{' '}
                {order.data.customer.id}
              </p>
              {order.data.booking ? (
                <>
                  <p>Mã đặt phòng: {order.data.booking.code}</p>
                  <p>Trạng thái đặt phòng: {order.data.booking.status}</p>
                  <p>Nhận phòng: {dateTime(order.data.booking.checkIn)}</p>
                  <p>Trả phòng: {dateTime(order.data.booking.checkOut)}</p>
                </>
              ) : (
                <p>Không còn thông tin đặt phòng.</p>
              )}
            </div>
          </Panel>
          <OrderReceipt order={order.data} presentation="workspace" />
          <Panel title="Ghi phí" className="min-w-0 break-words">
            <div className="space-y-2 text-sm">
              <p>{billingLabel(order.data)}</p>
              {order.data.billingStatus === 'BILLED' && (
                <p>
                  Tổng phí đã thêm vào hóa đơn: {money(order.data.amount)}. Không xác nhận khách đã
                  thanh toán.
                </p>
              )}
              {order.data.billedAt && <p>Thời điểm ghi phí: {dateTime(order.data.billedAt)}</p>}
              {order.data.review && (
                <>
                  <p>Quyết định đã lưu: {order.data.review.decision}</p>
                  <p className="whitespace-pre-wrap">
                    Lý do đã lưu: {order.data.review.reason || 'Không có'}
                  </p>
                  <p>Người duyệt: {order.data.review.reviewedBy}</p>
                  <p>Thời điểm duyệt: {dateTime(order.data.review.reviewedAt)}</p>
                </>
              )}
            </div>
          </Panel>
          <ReviewForm key={order.data.id} order={order.data} refreshing={order.isFetching} />
          <ServiceAssignment
            key={`assignment-${me?.id}-${me?.role}-${order.data.id}`}
            order={order.data}
            refreshing={order.isFetching}
          />
        </>
      )}
    </PageContainer>
  )
}
