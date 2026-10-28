import { useState } from 'react'
import { Alert } from '@/components/Alert'
import { Button } from '@/components/Button'
import { getErrorMessage } from '@/lib/api-client'
import type { BookingListItem, InvoiceTotals } from '../api'
import { useCheckOut, useInitiateFinal, useRecordCash } from '../hooks'
import { rememberPaymentRef } from '../storage'
import { money, newRequestId } from '../utils'

interface SettleAndCheckOutProps {
  booking: BookingListItem
  totals: InvoiceTotals
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
  onReload,
  reloading,
}: SettleAndCheckOutProps) {
  const cash = useRecordCash(booking.id)
  const vnpay = useInitiateFinal()
  const checkOut = useCheckOut()
  const [confirmCash, setConfirmCash] = useState(false)
  const [confirmCheckOut, setConfirmCheckOut] = useState(false)
  const [vnpayOpened, setVnpayOpened] = useState(false)
  // Giữ nguyên mã khi ghi lỗi để bấm lại không thu trùng; chỉ đổi sau khi ghi thành công.
  const [cashRequestId, setCashRequestId] = useState(newRequestId)

  const paid = totals.balanceDue === 0
  const roomNumbers = booking.rooms
    .map((room) => room.roomNumber)
    .filter(Boolean)
    .join(', ')

  async function confirmCashPayment() {
    try {
      await cash.mutateAsync(cashRequestId)
      setCashRequestId(newRequestId())
      setConfirmCash(false)
    } catch {
      // Lỗi hiển thị qua cash.error; giữ mã để lễ tân thử lại.
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
    <div className="space-y-3 border-t border-stone-300 pt-3">
      {paid ? (
        <p className="text-sm font-semibold text-success">Đã thanh toán đủ</p>
      ) : (
        <div className="space-y-3">
          {confirmCash ? (
            <div className="space-y-2 rounded border border-stone-300 bg-white p-3">
              <p className="text-sm">Xác nhận đã thu {money.format(totals.balanceDue)} tiền mặt?</p>
              <div className="flex flex-wrap gap-3">
                <Button size="sm" loading={cash.isPending} onClick={confirmCashPayment}>
                  Xác nhận đã thu tiền mặt
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setConfirmCash(false)
                    cash.reset()
                  }}
                >
                  Hủy
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-3">
              <Button size="sm" variant="secondary" onClick={() => setConfirmCash(true)}>
                Thu tiền mặt
              </Button>
              <Button size="sm" variant="secondary" loading={vnpay.isPending} onClick={startVnpay}>
                Thanh toán VNPay
              </Button>
            </div>
          )}
          {vnpayOpened && (
            <div className="flex flex-wrap items-center gap-3 text-sm text-stone-700">
              <span>Đã mở trang VNPay. Sau khi khách thanh toán xong, bấm Tải lại.</span>
              <Button size="sm" variant="ghost" loading={reloading} onClick={onReload}>
                Tải lại
              </Button>
            </div>
          )}
          {cash.isError && <Alert tone="danger">{getErrorMessage(cash.error)}</Alert>}
          {vnpay.isError && <Alert tone="danger">{getErrorMessage(vnpay.error)}</Alert>}
        </div>
      )}

      {confirmCheckOut ? (
        <div className="space-y-2 rounded border border-stone-300 bg-white p-3">
          <p className="text-sm">Xác nhận Check Out phòng {roomNumbers}?</p>
          <div className="flex flex-wrap gap-3">
            <Button size="sm" loading={checkOut.isPending} onClick={confirmCheckOutNow}>
              Xác nhận Check Out
            </Button>
            <Button
              size="sm"
              variant="ghost"
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
          <Button size="sm" disabled={!paid} onClick={() => setConfirmCheckOut(true)}>
            Check Out
          </Button>
          {!paid && (
            <p className="text-xs text-stone-700">Cần thanh toán đủ hóa đơn trước khi Check Out.</p>
          )}
        </div>
      )}
      {checkOut.isError && <Alert tone="danger">{getErrorMessage(checkOut.error)}</Alert>}
    </div>
  )
}
