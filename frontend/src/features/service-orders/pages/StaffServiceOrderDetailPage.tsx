import { useRef, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router'
import { Button, NativeSelect, Skeleton, StatusBadge, Textarea } from '@/components/atoms'
import { FormField } from '@/components/molecules'
import { ConfirmationDialog, PageContainer, PageHeader, Panel } from '@/components/organisms'
import { useAuth } from '@/features/auth/auth-context'
import { OrderReceipt } from '../presentation'
import { dateTime, money } from '../api'
import { useReviewStaffOrder, useStaffOrder } from '../staff-hooks'
import { billingLabel, type ReviewInput, type StaffServiceOrder } from '../staff-api'
import { StaffOrderError } from '../staff-presentation'
import { ServiceAssignment } from '../ServiceAssignment'
import { IntakeDetails } from '../IntakeDetails'

function ReviewForm({ order, refreshing }: { order: StaffServiceOrder; refreshing: boolean }) {
  const mutation = useReviewStaffOrder(order.id)
  const [decision, setDecision] = useState<ReviewInput['decision']>('ACCEPT')
  const [reason, setReason] = useState('')
  const [intent, setIntent] = useState<ReviewInput | null>(null)
  const [confirmation, setConfirmation] = useState<ReviewInput | null>(null)
  const [validation, setValidation] = useState('')
  const sending = useRef(false)
  const accepting = order.reviewStatus === 'ACCEPTING'
  const [recoveryMode, setRecoveryMode] = useState(false)
  const [recoveryContextTime] = useState(() => Date.now())
  const [recoveryReason, setRecoveryReason] = useState('')
  const canRecover =
    accepting &&
    order.review?.decision === 'ACCEPT' &&
    order.booking?.status === 'CONFIRMED' &&
    new Date(order.requestedTime).getTime() <= recoveryContextTime &&
    order.executionStatus === 'NOT_STARTED' &&
    order.billingStatus !== 'BILLED' &&
    !order.task &&
    !order.invoiceId &&
    !order.billedAt &&
    order.intakeMode !== 'COMPLETED_ON_SITE' &&
    order.intakeRole !== 'SERVICE_STAFF'
  const editingRecovery = recoveryMode && canRecover && !intent
  const persisted: ReviewInput | null =
    accepting && order.review?.decision === 'ACCEPT'
      ? {
          decision: 'ACCEPT',
          ...(order.review.reason !== undefined ? { reason: order.review.reason } : {}),
        }
      : null
  const locked = (accepting && !editingRecovery) || Boolean(intent)
  const activeIntent = intent ?? (accepting && !editingRecovery ? persisted : null)
  const final =
    order.reviewStatus === 'ACCEPTED' ||
    order.reviewStatus === 'REJECTED' ||
    order.reviewStatus === 'ABANDONED'
  const disabled = mutation.isPending || refreshing
  function prepare(event: FormEvent) {
    event.preventDefault()
    if (disabled || sending.current || final) return
    if (
      editingRecovery &&
      (!reason.trim() ||
        reason.trim().length > 2000 ||
        !recoveryReason.trim() ||
        recoveryReason.trim().length > 2000)
    ) {
      setValidation('Nhập lý do công khai và lý do khôi phục nội bộ (tối đa 2000 ký tự mỗi lý do).')
      return
    }
    const next: ReviewInput =
      activeIntent ??
      (editingRecovery
        ? {
            decision: 'REJECT',
            reason: reason.trim(),
            recoveryReason: recoveryReason.trim(),
            recoveryAction: 'ABANDON_EXPIRED',
          }
        : { decision, ...(reason.trim() ? { reason: reason.trim() } : {}) })
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
        {canRecover && !intent && !recoveryMode && (
          <Button
            type="button"
            variant="outline"
            className="h-auto whitespace-normal"
            disabled={disabled || Boolean(confirmation)}
            onClick={() => {
              setRecoveryMode(true)
              setReason('')
              setValidation('')
            }}
          >
            Dừng kỹ thuật lịch dịch vụ đã qua
          </Button>
        )}
        {(editingRecovery || intent?.recoveryAction) && (
          <p role="status">
            Dừng kỹ thuật, không phải từ chối thông thường. Lý do công khai được hiển thị cho khách;
            lý do khôi phục chỉ dành cho nội bộ. Máy chủ xác minh đặt phòng còn hiệu lực, lịch đã
            qua và không có phí hoặc công việc trước khi cho phép.
          </p>
        )}
        {accepting && !recoveryMode && (
          <p role="status">
            Đang chấp nhận, chờ hoàn tất ghi phí. Chỉ được thử lại quyết định ACCEPT và lý do đã
            lưu, không thể sửa.
          </p>
        )}
        {intent && (!accepting || intent.recoveryAction) && (
          <p role="status">Chưa xác nhận kết quả. Nội dung đã gửi được khóa để thử lại an toàn.</p>
        )}
        <FormField label="Quyết định" htmlFor="review-decision">
          <NativeSelect
            id="review-decision"
            value={activeIntent?.decision ?? (editingRecovery ? 'REJECT' : decision)}
            disabled={accepting || locked || disabled}
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
        {(editingRecovery || intent?.recoveryAction) && (
          <FormField
            label="Lý do khôi phục nội bộ (bắt buộc, tối đa 2000 ký tự)"
            htmlFor="review-recovery-reason"
          >
            <Textarea
              id="review-recovery-reason"
              maxLength={2000}
              value={intent?.recoveryReason ?? recoveryReason}
              disabled={Boolean(intent) || disabled}
              onChange={(event) => setRecoveryReason(event.target.value)}
            />
          </FormField>
        )}
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
          {mutation.isPending ? 'Đang xử lý…' : locked ? 'Thử lại cùng nội dung' : 'Gửi đơn'}
        </Button>
        {confirmation && (
          <ConfirmationDialog
            label={`Xác nhận ${confirmation.recoveryAction ? 'dừng kỹ thuật' : confirmation.decision === 'ACCEPT' ? 'chấp nhận' : 'từ chối'}`}
            busy={disabled}
            returnFocus={document.activeElement as HTMLElement}
            onCancel={() => setConfirmation(null)}
          >
            <h3 id="review-confirm-title" className="text-sm font-semibold">
              Xác nhận{' '}
              {confirmation.recoveryAction
                ? 'dừng kỹ thuật'
                : confirmation.decision === 'ACCEPT'
                  ? 'chấp nhận'
                  : 'từ chối'}
            </h3>
            {confirmation.recoveryAction ? (
              <p>
                Dừng kỹ thuật lịch dịch vụ đã qua. Máy chủ xác minh điều kiện an toàn; không ghi
                phí, không tạo công việc và giữ người duyệt, thời điểm chấp nhận ban đầu.
              </p>
            ) : confirmation.decision === 'REJECT' ? (
              <p>Từ chối yêu cầu, không ghi phí và không tạo công việc.</p>
            ) : (
              <p>
                {order.feeRequired
                  ? `Phí ước tính theo dữ liệu ghi nhận: ${money(order.amount)}. Khi hoàn tất, khoản phí được thêm vào hóa đơn, không phải thanh toán.`
                  : 'Dịch vụ không tính phí, không ghi phí vào hóa đơn.'}{' '}
                {order.intakeMode === 'COMPLETED_ON_SITE'
                  ? 'Ghi nhận đã thực hiện tại chỗ; khi duyệt xong không tạo công việc phân công.'
                  : 'Chưa phân công công việc ở bước này.'}
              </p>
            )}
            <p className="whitespace-pre-wrap break-words">
              Lý do: {confirmation.reason || 'Không có'}
            </p>
            {confirmation.recoveryAction && (
              <p className="whitespace-pre-wrap break-words">
                Lý do khôi phục nội bộ: {confirmation.recoveryReason}
              </p>
            )}
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
              <p>Khách hàng: {order.data.customer.fullName?.trim() || 'Chưa có tên khách hàng'}</p>
              {order.data.booking ? (
                <>
                  <p>Mã đặt phòng: {order.data.booking.code}</p>
                  <p>
                    Trạng thái đặt phòng: <StatusBadge status={order.data.booking.status} />
                  </p>
                  <p>Nhận phòng: {dateTime(order.data.booking.checkIn)}</p>
                  <p>Trả phòng: {dateTime(order.data.booking.checkOut)}</p>
                </>
              ) : (
                <p>Không còn thông tin đặt phòng.</p>
              )}
            </div>
          </Panel>
          <OrderReceipt order={order.data} presentation="workspace" />
          <IntakeDetails order={order.data} />
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
                  <p>
                    Quyết định đã lưu:{' '}
                    {order.data.review.decision === 'ACCEPT' ? 'Chấp nhận' : 'Từ chối'}
                  </p>
                  <p className="whitespace-pre-wrap">
                    Lý do đã lưu:{' '}
                    {order.data.acceptanceRecovery?.evidence?.reviewReason ??
                      order.data.review.reason ??
                      'Không có'}
                  </p>
                  <p>
                    Người duyệt:{' '}
                    {order.data.review.reviewedByName?.trim() || 'Chưa có tên người duyệt'}
                  </p>
                  <p>Thời điểm duyệt: {dateTime(order.data.review.reviewedAt)}</p>
                </>
              )}
            </div>
          </Panel>
          {order.data.acceptanceRecovery && (
            <Panel title="Lịch sử khôi phục chấp nhận" className="min-w-0 break-words">
              <div className="space-y-2 text-sm whitespace-pre-wrap">
                <p>
                  {order.data.acceptanceRecovery.action === 'ABANDON_EXPIRED'
                    ? 'Dừng kỹ thuật lịch dịch vụ đã qua · không phải từ chối thông thường'
                    : 'Khôi phục chấp nhận'}
                </p>
                <p>Lý do công khai: {order.data.acceptanceRecovery.rejectionReason}</p>
                <p>Lý do khôi phục nội bộ: {order.data.acceptanceRecovery.reason}</p>
                <p>
                  Vai trò thực hiện:{' '}
                  {order.data.acceptanceRecovery.actorRole === 'RECEPTIONIST'
                    ? 'Lễ tân'
                    : 'Không có thông tin'}
                </p>
                <p>Thời điểm khôi phục: {dateTime(order.data.acceptanceRecovery.at)}</p>
                {order.data.acceptanceRecovery.evidence && (
                  <>
                    <p>
                      Bằng chứng máy chủ tại thời điểm khôi phục:{' '}
                      {order.data.acceptanceRecovery.evidence.sourceChargeAbsent
                        ? 'Không có khoản phí nguồn'
                        : 'Chưa xác nhận không có phí'}{' '}
                      ·{' '}
                      {order.data.acceptanceRecovery.evidence.taskAbsent
                        ? 'Không có công việc'
                        : 'Chưa xác nhận không có công việc'}
                      .
                    </p>
                    {order.data.acceptanceRecovery.evidence.reviewedAt && (
                      <p>
                        Thời điểm chấp nhận ban đầu:{' '}
                        {dateTime(order.data.acceptanceRecovery.evidence.reviewedAt)}
                      </p>
                    )}
                  </>
                )}
              </div>
            </Panel>
          )}
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
