import { useRef, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router'
import { Button } from '@/components/Button'
import { OrderReceipt } from '../presentation'
import { dateTime, money } from '../api'
import { useReviewStaffOrder, useStaffOrder } from '../staff-hooks'
import { billingLabel, type ReviewInput, type StaffServiceOrder } from '../staff-api'
import { StaffOrderError } from '../staff-presentation'

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
    <form onSubmit={prepare} className="space-y-4 rounded border border-stone-300 bg-white p-4">
      <h2 className="font-display text-2xl">Duyệt yêu cầu</h2>
      {accepting && (
        <p role="status">
          Đang chấp nhận, chờ hoàn tất ghi phí. Chỉ được thử lại quyết định ACCEPT và lý do đã lưu,
          không thể sửa.
        </p>
      )}
      {intent && !accepting && (
        <p role="status">Chưa xác nhận kết quả. Nội dung đã gửi được khóa để thử lại an toàn.</p>
      )}
      <label className="block space-y-2">
        <span>Quyết định</span>
        <select
          className="min-h-11 w-full rounded border border-stone-300 p-2"
          value={activeIntent?.decision ?? decision}
          disabled={locked || disabled}
          onChange={(event) => setDecision(event.target.value as ReviewInput['decision'])}
        >
          <option value="ACCEPT">Chấp nhận</option>
          <option value="REJECT">Từ chối</option>
        </select>
      </label>
      <label className="block space-y-2">
        <span>Lý do (bắt buộc khi từ chối, tối đa 2000 ký tự)</span>
        <textarea
          className="min-h-28 w-full rounded border border-stone-300 p-2"
          maxLength={2000}
          value={activeIntent?.reason ?? (locked ? '' : reason)}
          disabled={locked || disabled}
          onChange={(event) => setReason(event.target.value)}
        />
      </label>
      {validation && (
        <p role="alert" className="text-danger">
          {validation}
        </p>
      )}
      {mutation.isError && <StaffOrderError error={mutation.error} />}
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
        <div
          role="dialog"
          aria-labelledby="review-confirm-title"
          className="space-y-4 rounded border border-primary bg-cream-50 p-4"
        >
          <h3 id="review-confirm-title" className="font-display text-2xl">
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
        </div>
      )}
    </form>
  )
}
export function StaffServiceOrderDetailPage() {
  const { id = '' } = useParams()
  const order = useStaffOrder(id)
  return (
    <section className="mx-auto max-w-container space-y-6 px-4 py-8">
      <Link
        className="inline-flex min-h-11 items-center text-primary underline"
        to="/staff/service-orders"
      >
        Yêu cầu dịch vụ
      </Link>
      <h1 className="font-display text-3xl">Chi tiết yêu cầu dịch vụ</h1>
      <Button variant="secondary" disabled={order.isFetching} onClick={() => void order.refetch()}>
        Tải lại trạng thái
      </Button>
      {order.isPending && <p role="status">Đang tải yêu cầu dịch vụ…</p>}
      {order.isError && <StaffOrderError error={order.error} retry={() => void order.refetch()} />}
      {order.data && (
        <>
          <div className="space-y-2 rounded border border-stone-300 bg-white p-4 break-words">
            <h2 className="font-display text-2xl">Khách hàng và đặt phòng</h2>
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
          <OrderReceipt order={order.data} />
          <div className="space-y-2 rounded border border-stone-300 bg-white p-4 break-words">
            <h2 className="font-display text-2xl">Ghi phí</h2>
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
          <ReviewForm key={order.data.id} order={order.data} refreshing={order.isFetching} />
        </>
      )}
    </section>
  )
}
