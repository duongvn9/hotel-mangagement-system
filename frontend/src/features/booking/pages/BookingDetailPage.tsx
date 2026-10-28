import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { Alert } from '@/components/Alert'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { TextField } from '@/components/TextField'
import { getErrorMessage } from '@/lib/api-client'
import { useAuth } from '@/features/auth/auth-context'
import { BOOKING_STATUS_DISPLAY, type InitiatePaymentInput } from '../api'
import {
  useBooking,
  useCancelBooking,
  useInitiateDeposit,
  useInitiateFinal,
} from '../hooks'
import { rememberPaymentRef, upsertStoredBooking } from '../storage'
import { formatDate, formatDateTime, money, nightsBetween } from '../utils'
import { formatRemaining, useHoldCountdown } from './useHoldCountdown'

/**
 * UC09/UC12/UC20/UC21 — chi tiết & thao tác với một booking. Trạng thái và hạn giữ phòng
 * đọc authoritative từ backend (GET /bookings/:id); localStorage chỉ là bộ nhớ đệm hiển thị.
 */
export function BookingDetailPage() {
  const { id = '' } = useParams()
  const [params] = useSearchParams()
  const { me } = useAuth()

  const [typedCode, setTypedCode] = useState(params.get('code') ?? '')
  const [confirmCancel, setConfirmCancel] = useState(false)

  const deposit = useInitiateDeposit()
  const final = useInitiateFinal()
  const cancel = useCancelBooking()

  const code = typedCode.trim()
  const query = useBooking(id, { ...(code ? { code } : {}) })
  const booking = query.data

  // Khách từ thiết bị khác (không có phiên/không đăng nhập) cần mã booking để đọc.
  const needsCode = query.isError && !me && !code

  // Đồng bộ bản lưu client theo dữ liệu authoritative để màn "Đặt phòng của tôi" không lỗi thời.
  useEffect(() => {
    if (booking) upsertStoredBooking(booking)
  }, [booking])

  const status = booking?.status
  const cancelled = status === 'CANCELLED'
  const expired = status === 'EXPIRED'
  const statusDisplay = status ? (BOOKING_STATUS_DISPLAY[status] ?? undefined) : undefined

  const holding = status === 'PENDING_DEPOSIT' || status === 'ROOM_HELD'
  const remaining = useHoldCountdown(holding ? booking?.holdExpiresAt : undefined)
  const holdExpired = remaining !== null && remaining <= 0

  function payload(): InitiatePaymentInput {
    return { bookingId: id, ...(me ? {} : { code }) }
  }

  async function pay(kind: 'deposit' | 'final') {
    const mutation = kind === 'deposit' ? deposit : final
    try {
      const result = await mutation.mutateAsync(payload())
      // Nhớ giao dịch này thuộc booking nào để trang Return đọc đúng trạng thái.
      rememberPaymentRef(result.transactionRef, id)
      window.location.href = result.paymentUrl
    } catch {
      // Lỗi hiển thị qua mutation.isError.
    }
  }

  async function doCancel() {
    try {
      await cancel.mutateAsync({ id, ...(me ? {} : { code }) })
      setConfirmCancel(false)
      await query.refetch()
    } catch {
      // Lỗi hiển thị qua cancel.isError.
    }
  }

  return (
    <section className="mx-auto max-w-container space-y-6 px-4 py-10 font-body">
      <div>
        <p className="text-xs font-semibold tracking-widest text-primary uppercase">Đặt phòng</p>
        <h1 className="font-display text-4xl font-semibold text-pearl-900">Chi tiết đặt phòng</h1>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          {booking && (
            <span className="text-sm text-stone-700">
              Mã booking{' '}
              <span className="font-semibold tracking-wide text-pearl-900">{booking.code}</span>
            </span>
          )}
          {statusDisplay && <Badge tone={statusDisplay.tone}>{statusDisplay.label}</Badge>}
        </div>
      </div>

      {query.isPending && !needsCode && <p role="status">Đang tải thông tin đặt phòng…</p>}

      {query.isError && !needsCode && (
        <Alert tone="danger">{getErrorMessage(query.error, 'Không đọc được thông tin đặt phòng.')}</Alert>
      )}

      {needsCode && (
        <>
          <Alert tone="info">
            Nhập mã booking (vé) đã nhận để xem và thao tác với đơn này trên thiết bị hiện tại.
          </Alert>
          <div className="max-w-sm">
            <TextField
              label="Mã booking (vé)"
              placeholder="BK..."
              value={typedCode}
              onChange={(event) => setTypedCode(event.target.value)}
            />
          </div>
        </>
      )}

      {booking && (
        <>
          {holding && !holdExpired && remaining !== null && (
            <Alert tone="warning">
              Phòng đang được giữ. Vui lòng đặt cọc trong{' '}
              <strong>{formatRemaining(remaining)}</strong>, nếu không phòng sẽ được mở lại.
            </Alert>
          )}
          {holding && holdExpired && (
            <Alert tone="danger">
              Đã quá thời gian giữ phòng. Trạng thái sẽ sớm chuyển sang hết hạn; vui lòng tìm phòng
              lại nếu bạn vẫn muốn đặt.
            </Alert>
          )}
          {expired && (
            <Alert tone="danger">
              Đơn đã hết hạn giữ phòng và phòng đã được mở lại. Vui lòng tìm phòng để đặt lại.
            </Alert>
          )}
          {cancelled && <Alert tone="success">Booking đã được huỷ và phòng đã được mở lại.</Alert>}

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
              <dd className="mt-1 font-semibold">
                {booking.adultCount} người lớn
                {booking.childCount > 0 ? `, ${booking.childCount} trẻ em` : ''}
              </dd>
            </div>
            <div>
              <dt className="text-xs tracking-wider text-stone-700 uppercase">Tiền phòng</dt>
              <dd className="mt-1 font-semibold tabular-nums">{money.format(booking.roomTotal)}</dd>
            </div>
            <div>
              <dt className="text-xs tracking-wider text-stone-700 uppercase">Tiền cọc</dt>
              <dd className="mt-1 font-semibold text-primary tabular-nums">
                {money.format(booking.depositAmount)}
              </dd>
            </div>
            {booking.holdExpiresAt && holding && (
              <div>
                <dt className="text-xs tracking-wider text-stone-700 uppercase">Giữ phòng đến</dt>
                <dd className="mt-1 font-semibold">{formatDateTime(booking.holdExpiresAt)}</dd>
              </div>
            )}
          </dl>
        </>
      )}

      {deposit.isError && <Alert tone="danger">{getErrorMessage(deposit.error)}</Alert>}
      {final.isError && <Alert tone="danger">{getErrorMessage(final.error)}</Alert>}
      {cancel.isError && <Alert tone="danger">{getErrorMessage(cancel.error)}</Alert>}

      {booking && !cancelled && !expired && (
        <div className="flex flex-wrap gap-3">
          {status === 'PENDING_DEPOSIT' && (
            <Button
              loading={deposit.isPending}
              disabled={holdExpired}
              onClick={() => void pay('deposit')}
            >
              Đặt cọc qua VNPay
            </Button>
          )}
          {(status === 'CONFIRMED' || status === 'CHECKED_OUT') && (
            <Button
              variant="secondary"
              loading={final.isPending}
              onClick={() => void pay('final')}
            >
              Thanh toán phần còn lại
            </Button>
          )}
          {status !== 'CHECKED_IN' && status !== 'CHECKED_OUT' && status !== 'ROOM_HELD' && (
            <Button variant="danger" onClick={() => setConfirmCancel(true)}>
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
