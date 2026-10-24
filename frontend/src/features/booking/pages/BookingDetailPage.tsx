import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { Alert } from '@/components/Alert'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { TextField } from '@/components/TextField'
import { getErrorMessage } from '@/lib/api-client'
import { useAuth } from '@/features/auth/auth-context'
import { BOOKING_STATUS_DISPLAY, type InitiatePaymentInput } from '../api'
import { useCancelBooking, useInitiateDeposit, useInitiateFinal } from '../hooks'
import {
  getStoredBooking,
  patchStoredBooking,
  rememberPaymentRef,
  type StoredBooking,
} from '../storage'
import { formatDate, formatDateTime, money, nightsBetween } from '../utils'

/** Đếm ngược tới thời điểm giữ phòng hết hạn. */
function useCountdown(target?: string): number | null {
  const [remaining, setRemaining] = useState<number | null>(() =>
    target ? Date.parse(target) - Date.now() : null,
  )
  useEffect(() => {
    if (!target) return
    const tick = () => setRemaining(Date.parse(target) - Date.now())
    tick()
    const timer = window.setInterval(tick, 1000)
    return () => window.clearInterval(timer)
  }, [target])
  return remaining
}

function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

/** UC09 (đọc lại ở client) + UC12/UC20/UC21 — chi tiết & thao tác với một booking. */
export function BookingDetailPage() {
  const { id = '' } = useParams()
  const [params] = useSearchParams()
  const { me } = useAuth()

  const [booking, setBooking] = useState<StoredBooking | undefined>(() => getStoredBooking(id))
  const [typedCode, setTypedCode] = useState(params.get('code') ?? '')
  const [confirmCancel, setConfirmCancel] = useState(false)

  const deposit = useInitiateDeposit()
  const final = useInitiateFinal()
  const cancel = useCancelBooking()

  const code = booking?.code ?? typedCode.trim()
  const needsCode = !me && !code
  const status = booking?.status
  const cancelled = status === 'CANCELLED'
  const statusDisplay = status ? BOOKING_STATUS_DISPLAY[status] : undefined

  const remaining = useCountdown(status === 'PENDING_DEPOSIT' ? booking?.holdExpiresAt : undefined)
  const holdExpired = remaining !== null && remaining <= 0

  function payload(): InitiatePaymentInput {
    return { bookingId: id, ...(me ? {} : { code }) }
  }

  async function pay(kind: 'deposit' | 'final') {
    const mutation = kind === 'deposit' ? deposit : final
    try {
      const result = await mutation.mutateAsync(payload())
      // Nhớ giao dịch này thuộc booking nào để trang Return cập nhật đúng.
      rememberPaymentRef(result.transactionRef, id)
      // Chuyển hướng sang cổng VNPay để khách thanh toán.
      window.location.href = result.paymentUrl
    } catch {
      // Lỗi hiển thị qua mutation.isError.
    }
  }

  async function doCancel() {
    try {
      const result = await cancel.mutateAsync({ id, ...(me ? {} : { code }) })
      patchStoredBooking(id, { status: result.status })
      setBooking((previous) => (previous ? { ...previous, status: result.status } : previous))
      setConfirmCancel(false)
    } catch {
      // Lỗi hiển thị qua cancel.isError.
    }
  }

  return (
    <section className="mx-auto max-w-container space-y-6 px-4 py-10 font-body">
      <div>
        <p className="text-xs font-semibold tracking-widest text-primary uppercase">Đặt phòng</p>
        <h1 className="font-display text-4xl font-semibold text-pearl-900">
          {booking ? `Booking ${booking.code}` : 'Chi tiết booking'}
        </h1>
        {statusDisplay && (
          <div className="mt-2">
            <Badge tone={statusDisplay.tone}>{statusDisplay.label}</Badge>
          </div>
        )}
      </div>

      {!booking && (
        <Alert tone="info">
          Không có thông tin chi tiết của booking này trên thiết bị hiện tại. Bạn vẫn có thể đặt cọc
          hoặc huỷ nếu nhập đúng mã booking (vé) đã nhận.
        </Alert>
      )}

      {booking && (
        <>
          {status === 'PENDING_DEPOSIT' && !holdExpired && remaining !== null && (
            <Alert tone="warning">
              Phòng đang được giữ. Vui lòng đặt cọc trong{' '}
              <strong>{formatRemaining(remaining)}</strong> phút, nếu không phòng sẽ được mở lại.
            </Alert>
          )}
          {status === 'PENDING_DEPOSIT' && holdExpired && (
            <Alert tone="danger">
              Đã quá thời gian giữ phòng. Nếu phòng đã bị khách khác đặt, việc đặt cọc có thể không
              thành công — vui lòng tìm phòng lại.
            </Alert>
          )}

          <dl className="grid gap-4 rounded-lg border border-stone-300 bg-white p-6 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-xs tracking-wider text-stone-700 uppercase">Nhận phòng</dt>
              <dd className="mt-1 font-semibold">{formatDate(booking.checkIn)}</dd>
            </div>
            <div>
              <dt className="text-xs tracking-wider text-stone-700 uppercase">Trả phòng</dt>
              <dd className="mt-1 font-semibold">{formatDate(booking.checkOut)}</dd>
            </div>
            <div>
              <dt className="text-xs tracking-wider text-stone-700 uppercase">Phòng · Đêm</dt>
              <dd className="mt-1 font-semibold">
                {booking.rooms.length} phòng · {nightsBetween(booking.checkIn, booking.checkOut)}{' '}
                đêm
              </dd>
            </div>
            <div>
              <dt className="text-xs tracking-wider text-stone-700 uppercase">Số khách</dt>
              <dd className="mt-1 font-semibold">{booking.guests}</dd>
            </div>
            <div>
              <dt className="text-xs tracking-wider text-stone-700 uppercase">Tiền phòng</dt>
              <dd className="mt-1 font-semibold">{money.format(booking.roomTotal)}</dd>
            </div>
            <div>
              <dt className="text-xs tracking-wider text-stone-700 uppercase">Tiền cọc</dt>
              <dd className="mt-1 font-semibold text-primary">
                {money.format(booking.depositAmount)}
              </dd>
            </div>
            {booking.holdExpiresAt && status === 'PENDING_DEPOSIT' && (
              <div>
                <dt className="text-xs tracking-wider text-stone-700 uppercase">Giữ phòng đến</dt>
                <dd className="mt-1 font-semibold">{formatDateTime(booking.holdExpiresAt)}</dd>
              </div>
            )}
          </dl>
        </>
      )}

      {needsCode && (
        <div className="max-w-sm">
          <TextField
            label="Mã booking (vé)"
            placeholder="BK..."
            value={typedCode}
            onChange={(event) => setTypedCode(event.target.value)}
          />
        </div>
      )}

      {deposit.isError && <Alert tone="danger">{getErrorMessage(deposit.error)}</Alert>}
      {final.isError && <Alert tone="danger">{getErrorMessage(final.error)}</Alert>}
      {cancel.isError && <Alert tone="danger">{getErrorMessage(cancel.error)}</Alert>}
      {cancelled && <Alert tone="success">Booking đã được huỷ và phòng đã được mở lại.</Alert>}

      {!cancelled && (
        <div className="flex flex-wrap gap-3">
          {(status === 'PENDING_DEPOSIT' || !booking) && (
            <Button
              loading={deposit.isPending}
              disabled={needsCode}
              onClick={() => void pay('deposit')}
            >
              Đặt cọc qua VNPay
            </Button>
          )}
          {(status === 'CONFIRMED' || status === 'CHECKED_OUT' || !booking) && (
            <Button
              variant="secondary"
              loading={final.isPending}
              disabled={needsCode}
              onClick={() => void pay('final')}
            >
              Thanh toán phần còn lại
            </Button>
          )}
          {status !== 'CHECKED_IN' && status !== 'CHECKED_OUT' && (
            <Button variant="danger" disabled={needsCode} onClick={() => setConfirmCancel(true)}>
              Huỷ booking
            </Button>
          )}
        </div>
      )}

      {confirmCancel && (
        <div
          role="alertdialog"
          aria-label="Xác nhận huỷ booking"
          className="space-y-3 rounded-lg border border-danger bg-danger-bg p-5"
        >
          <p className="text-sm text-stone-700">
            Huỷ booking này? Phòng đang giữ sẽ được mở lại. Thao tác không thể hoàn tác.
          </p>
          <div className="flex gap-3">
            <Button variant="danger" loading={cancel.isPending} onClick={() => void doCancel()}>
              Xác nhận huỷ
            </Button>
            <Button variant="secondary" onClick={() => setConfirmCancel(false)}>
              Giữ lại
            </Button>
          </div>
        </div>
      )}

      <div>
        <Link to="/my-bookings" className="text-sm text-primary underline">
          ← Về danh sách đặt phòng của tôi
        </Link>
      </div>
    </section>
  )
}
