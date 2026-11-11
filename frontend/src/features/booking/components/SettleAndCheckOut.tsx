import { useState } from 'react'
import { Button } from '@/components/atoms'
import { Alert } from '@/components/molecules'
import { getErrorMessage } from '@/lib/api-client'
import type { BookingListItem, DeskPaymentMethod, InvoiceTotals } from '../api'
import {
  useCancelPendingVnpay,
  useCheckOut,
  useCheckoutInspection,
  useConfirmFees,
  useInitiateFinal,
  useRecordCash,
} from '../hooks'
import { rememberPaymentRef } from '../storage'
import { money, newRequestId } from '../utils'

interface SettleAndCheckOutProps {
  booking: BookingListItem
  totals: InvoiceTotals
  /** Lúc khách xác nhận các khoản phí; chưa có thì chưa cho thu tiền. */
  feesConfirmedAt?: string
  /** Server báo còn giao dịch VNPay đang chờ (kể cả khi mở lại hộp thoại sau khi đã rời trang VNPay). */
  vnpayPending?: boolean
  /** Tải lại hóa đơn, dùng sau khi khách thanh toán VNPay ở tab khác. */
  onReload: () => void
  reloading: boolean
}

/**
 * UC18 — Thu nốt hóa đơn (tiền mặt hoặc VNPay do lễ tân thực hiện) rồi Check Out. Chỉ cho
 * Check Out khi hóa đơn đã thanh toán đủ; server vẫn kiểm tra lại các điều kiện này.
 */
export function SettleAndCheckOut({
  booking,
  totals,
  feesConfirmedAt,
  vnpayPending = false,
  onReload,
  reloading,
}: SettleAndCheckOutProps) {
  const cash = useRecordCash(booking.id)
  const card = useRecordCash(booking.id, 'card')
  const confirmFees = useConfirmFees(booking.id)
  const vnpay = useInitiateFinal()
  const cancelVnpay = useCancelPendingVnpay(booking.id)
  const checkOut = useCheckOut()
  const inspection = useCheckoutInspection(booking.id)
  const [confirmMethod, setConfirmMethod] = useState<DeskPaymentMethod | null>(null)
  const [confirmCheckOut, setConfirmCheckOut] = useState(false)
  const [vnpayOpened, setVnpayOpened] = useState(false)
  // Giữ nguyên mã khi ghi lỗi để bấm lại không thu trùng; chỉ đổi sau khi ghi thành công.
  const [cashRequestId, setCashRequestId] = useState(newRequestId)
  const [cardRequestId, setCardRequestId] = useState(newRequestId)

  const paid = totals.balanceDue === 0
  // Chỉ Check Out khi nhân viên dịch vụ đã xác nhận kiểm tra phòng (lần kiểm tra gần nhất hoàn thành).
  const inspectionStatus = inspection.data?.status
  const roomInspected = inspectionStatus === 'COMPLETED'
  const inspectionHint = !inspection.isSuccess
    ? inspection.isError
      ? 'Không tải được trạng thái kiểm tra phòng.'
      : ''
    : roomInspected
      ? ''
      : inspectionStatus === 'ASSIGNED' || inspectionStatus === 'IN_PROGRESS'
        ? 'Đang chờ nhân viên dịch vụ xác nhận kiểm tra phòng.'
        : 'Cần yêu cầu nhân viên dịch vụ kiểm tra phòng trước khi Check Out.'
  const feesConfirmed = Boolean(feesConfirmedAt)
  const roomNumbers = booking.rooms
    .map((room) => room.roomNumber)
    .filter(Boolean)
    .join(', ')

  async function confirmDeskPayment(method: DeskPaymentMethod) {
    const mutation = method === 'card' ? card : cash
    const requestId = method === 'card' ? cardRequestId : cashRequestId
    try {
      await mutation.mutateAsync(requestId)
      if (method === 'card') setCardRequestId(newRequestId())
      else setCashRequestId(newRequestId())
      setConfirmMethod(null)
    } catch {
      // Lỗi hiển thị qua mutation.error; giữ mã để lễ tân thử lại.
    }
  }

  async function startVnpay() {
    try {
      const result = await vnpay.mutateAsync({ bookingId: booking.id })
      // Nhớ giao dịch thuộc booking nào để trang kết quả VNPay cập nhật đúng.
      rememberPaymentRef(result.transactionRef, booking.id)
      window.open(result.paymentUrl, '_blank', 'noopener')
      setVnpayOpened(true)
    } catch {
      // Lỗi hiển thị qua vnpay.error.
    }
  }

  async function cancelPendingVnpay() {
    try {
      await cancelVnpay.mutateAsync()
      setVnpayOpened(false)
    } catch {
      // Lỗi hiển thị qua cancelVnpay.error; nút huỷ vẫn còn để thử lại.
    }
  }

  async function confirmCheckOutNow() {
    try {
      await checkOut.mutateAsync(booking.id)
    } catch {
      // Lỗi hiển thị qua checkOut.error; danh sách tự làm mới khi thành công.
    }
  }

  return (
    <div className="space-y-3 border-t border-border pt-3">
      {paid ? (
        <p className="text-sm font-semibold text-success">Đã thanh toán đủ</p>
      ) : (
        <div className="space-y-3">
          {feesConfirmed ? (
            <p className="text-sm font-semibold text-success">Khách đã xác nhận các khoản phí</p>
          ) : (
            <div className="space-y-2 rounded-xl border border-border bg-card p-3">
              <p className="text-sm text-muted-foreground">
                Cho khách xem các khoản phí của hóa đơn. Khách đồng ý thì mới thu tiền.
              </p>
              <Button
                size="sm"
                className="rounded-full"
                disabled={confirmFees.isPending}
                onClick={() => confirmFees.mutate()}
              >
                Khách đã xác nhận phí
              </Button>
              {confirmFees.isError && (
                <Alert tone="danger">{getErrorMessage(confirmFees.error)}</Alert>
              )}
            </div>
          )}
          {confirmMethod ? (
            <div className="space-y-2 rounded-xl border border-border bg-card p-3">
              <p className="text-sm text-foreground">
                {confirmMethod === 'card'
                  ? `Xác nhận đã thu thẻ ${money.format(totals.balanceDue)}?`
                  : `Xác nhận đã thu ${money.format(totals.balanceDue)} tiền mặt?`}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  className="rounded-full"
                  disabled={(confirmMethod === 'card' ? card : cash).isPending}
                  onClick={() => confirmDeskPayment(confirmMethod)}
                >
                  {confirmMethod === 'card' ? 'Xác nhận đã thu thẻ' : 'Xác nhận đã thu tiền mặt'}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="rounded-full"
                  onClick={() => {
                    setConfirmMethod(null)
                    cash.reset()
                    card.reset()
                  }}
                >
                  Hủy
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="secondary"
                className="rounded-full"
                disabled={!feesConfirmed}
                onClick={() => setConfirmMethod('cash')}
              >
                Thu tiền mặt
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="rounded-full"
                disabled={!feesConfirmed}
                onClick={() => setConfirmMethod('card')}
              >
                Thu thẻ
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="rounded-full"
                disabled={!feesConfirmed || vnpay.isPending}
                onClick={startVnpay}
              >
                Thanh toán VNPay
              </Button>
            </div>
          )}
          {(vnpayOpened || vnpayPending) && (
            <div className="space-y-2 rounded-xl border border-border bg-card p-3">
              <p className="text-sm text-muted-foreground">
                {vnpayOpened
                  ? 'Đã mở trang VNPay. Sau khi khách thanh toán xong, bấm Tải lại.'
                  : 'Đang chờ thanh toán VNPay. Sau khi khách thanh toán xong, bấm Tải lại.'}{' '}
                Khách không thanh toán nữa thì hủy để thu bằng tiền mặt hoặc thẻ.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  className="rounded-full"
                  disabled={reloading}
                  onClick={onReload}
                >
                  Tải lại
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-full"
                  disabled={cancelVnpay.isPending}
                  onClick={cancelPendingVnpay}
                >
                  Hủy thanh toán VNPay
                </Button>
              </div>
              {cancelVnpay.isError && (
                <Alert tone="danger">{getErrorMessage(cancelVnpay.error)}</Alert>
              )}
            </div>
          )}
          {cash.isError && <Alert tone="danger">{getErrorMessage(cash.error)}</Alert>}
          {card.isError && <Alert tone="danger">{getErrorMessage(card.error)}</Alert>}
          {vnpay.isError && <Alert tone="danger">{getErrorMessage(vnpay.error)}</Alert>}
        </div>
      )}

      {confirmCheckOut ? (
        <div className="space-y-2 rounded-xl border border-border bg-card p-3">
          <p className="text-sm text-foreground">Xác nhận Check Out phòng {roomNumbers}?</p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              className="rounded-full"
              disabled={checkOut.isPending}
              onClick={confirmCheckOutNow}
            >
              Xác nhận Check Out
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="rounded-full"
              onClick={() => {
                setConfirmCheckOut(false)
                checkOut.reset()
              }}
            >
              Hủy
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-1">
          <Button
            size="sm"
            disabled={!paid || !roomInspected}
            className="rounded-full"
            onClick={() => setConfirmCheckOut(true)}
          >
            Check Out
          </Button>
          {!paid && (
            <p className="text-xs text-muted-foreground">
              Cần thanh toán đủ hóa đơn trước khi Check Out.
            </p>
          )}
          {inspectionHint && <p className="text-xs text-muted-foreground">{inspectionHint}</p>}
        </div>
      )}
      {checkOut.isError && <Alert tone="danger">{getErrorMessage(checkOut.error)}</Alert>}
    </div>
  )
}
