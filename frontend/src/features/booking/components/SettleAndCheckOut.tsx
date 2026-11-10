import { useState } from 'react'
import { Button } from '@/components/atoms'
import { Alert } from '@/components/molecules'
import { getErrorMessage } from '@/lib/api-client'
import type { BookingListItem, DeskPaymentMethod, InvoiceTotals } from '../api'
import { useCheckOut, useConfirmFees, useInitiateFinal, useRecordCash } from '../hooks'
import { rememberPaymentRef } from '../storage'
import { money, newRequestId } from '../utils'

interface SettleAndCheckOutProps {
  booking: BookingListItem
  totals: InvoiceTotals
  /** Lúc khách xác nhận các khoản phí; chưa có thì chưa cho thu tiền. */
  feesConfirmedAt?: string
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
  onReload,
  reloading,
}: SettleAndCheckOutProps) {
  const cash = useRecordCash(booking.id)
  const card = useRecordCash(booking.id, 'card')
  const confirmFees = useConfirmFees(booking.id)
  const vnpay = useInitiateFinal()
  const checkOut = useCheckOut()
  const [confirmMethod, setConfirmMethod] = useState<DeskPaymentMethod | null>(null)
  const [confirmCheckOut, setConfirmCheckOut] = useState(false)
  const [vnpayOpened, setVnpayOpened] = useState(false)
  // Giữ nguyên mã khi ghi lỗi để bấm lại không thu trùng; chỉ đổi sau khi ghi thành công.
  const [cashRequestId, setCashRequestId] = useState(newRequestId)
  const [cardRequestId, setCardRequestId] = useState(newRequestId)

  const paid = totals.balanceDue === 0
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
          {vnpayOpened && (
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>Đã mở trang VNPay. Sau khi khách thanh toán xong, bấm Tải lại.</span>
              <Button
                size="sm"
                variant="ghost"
                className="rounded-full"
                disabled={reloading}
                onClick={onReload}
              >
                Tải lại
              </Button>
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
            disabled={!paid}
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
        </div>
      )}
      {checkOut.isError && <Alert tone="danger">{getErrorMessage(checkOut.error)}</Alert>}
    </div>
  )
}
