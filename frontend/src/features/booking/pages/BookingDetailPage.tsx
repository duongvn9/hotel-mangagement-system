import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { Button, Input, StatusBadge } from '@/components/atoms'
import { FormField } from '@/components/molecules'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/organisms'
import { useAuth } from '@/features/auth/auth-context'
import { getErrorMessage } from '@/lib/api-client'
import { fdate, fshort, vnd } from '@/lib/format'
import type { InitiatePaymentInput } from '../api'
import { useBooking, useCancelBooking, useInitiateDeposit, useInitiateFinal } from '../hooks'
import { nightsBetween } from '../utils'
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

  const status = booking?.status
  const cancelled = status === 'CANCELLED'
  const expired = status === 'EXPIRED'

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
    <div className="mx-auto max-w-5xl px-5 py-10 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-widest text-primary uppercase">Đặt phòng</p>
          <h1 className="font-display text-4xl font-semibold">Chi tiết đặt phòng</h1>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            {booking && (
              <span className="text-sm text-muted-foreground">
                Mã booking <span className="font-semibold text-foreground">{booking.code}</span>
              </span>
            )}
            {status && <StatusBadge status={status} />}
          </div>
        </div>
        <Link
          to="/my-bookings"
          className="text-sm text-muted-foreground transition hover:text-foreground"
        >
          ← Danh sách đặt phòng của tôi
        </Link>
      </div>

      {query.isPending && !needsCode && (
        <div role="status" className="py-12">
          <p className="text-muted-foreground">Đang tải thông tin đặt phòng…</p>
        </div>
      )}

      {query.isError && !needsCode && (
        <div
          role="alert"
          className="mt-6 rounded-xl border border-destructive/20 bg-destructive/10 p-5 text-destructive"
        >
          {getErrorMessage(query.error, 'Không đọc được thông tin đặt phòng.')}
        </div>
      )}

      {needsCode && (
        <div className="mt-8 max-w-md space-y-4">
          <div
            role="alert"
            className="rounded-xl border border-primary/20 bg-primary/10 p-4 text-sm text-foreground"
          >
            Nhập mã booking (vé) đã nhận để xem và thao tác với đơn này trên thiết bị hiện tại.
          </div>
          <FormField label="Mã booking (vé)" htmlFor="typedCode">
            <Input
              id="typedCode"
              placeholder="BK..."
              value={typedCode}
              onChange={(event) => setTypedCode(event.target.value)}
            />
          </FormField>
        </div>
      )}

      {booking && (
        <div className="mt-8 space-y-6">
          {holding && !holdExpired && remaining !== null && (
            <div className="rounded-xl border border-primary/20 bg-primary/10 p-4 text-sm text-foreground">
              Phòng đang được giữ. Vui lòng đặt cọc trong{' '}
              <strong>{formatRemaining(remaining)}</strong>, nếu không phòng sẽ được mở lại.
            </div>
          )}
          {holding && holdExpired && (
            <div
              role="alert"
              className="rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-destructive"
            >
              Đã quá thời gian giữ phòng. Trạng thái sẽ sớm chuyển sang hết hạn; vui lòng tìm phòng
              lại nếu bạn vẫn muốn đặt.
            </div>
          )}
          {expired && (
            <div
              role="alert"
              className="rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-destructive"
            >
              Đơn đã hết hạn giữ phòng và phòng đã được mở lại. Vui lòng tìm phòng để đặt lại.
            </div>
          )}
          {cancelled && (
            <div
              role="alert"
              className="rounded-xl border border-success/20 bg-success/10 p-4 text-success"
            >
              Booking đã được huỷ và phòng đã được mở lại.
            </div>
          )}

          <div className="card-soft grid gap-6 p-6 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Nhận phòng</p>
              <p className="mt-1 font-semibold">{fdate(booking.checkIn)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Trả phòng</p>
              <p className="mt-1 font-semibold">{fdate(booking.checkOut)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Phòng · Đêm</p>
              <p className="mt-1 font-semibold">
                {booking.rooms.length} phòng · {nightsBetween(booking.checkIn, booking.checkOut)}{' '}
                đêm
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Số khách</p>
              <p className="mt-1 font-semibold">
                {booking.adultCount} người lớn
                {booking.childCount > 0 ? `, ${booking.childCount} trẻ em` : ''}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Tiền phòng</p>
              <p className="mt-1 font-semibold tabular-nums">{vnd(booking.roomTotal)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Tiền cọc</p>
              <p className="mt-1 font-semibold tabular-nums text-primary">
                {vnd(booking.depositAmount)}
              </p>
            </div>
            {booking.holdExpiresAt && holding && (
              <div className="sm:col-span-2">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  Giữ phòng đến
                </p>
                <p className="mt-1 font-semibold">{fshort(booking.holdExpiresAt)}</p>
              </div>
            )}
          </div>

          {deposit.isError && (
            <div
              role="alert"
              className="rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-destructive"
            >
              {getErrorMessage(deposit.error)}
            </div>
          )}
          {final.isError && (
            <div
              role="alert"
              className="rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-destructive"
            >
              {getErrorMessage(final.error)}
            </div>
          )}
          {cancel.isError && (
            <div
              role="alert"
              className="rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-destructive"
            >
              {getErrorMessage(cancel.error)}
            </div>
          )}

          {!cancelled && !expired && (
            <div className="flex flex-wrap gap-3 pt-2">
              {status === 'PENDING_DEPOSIT' && (
                <Button
                  className="rounded-full px-6"
                  disabled={holdExpired || deposit.isPending}
                  aria-busy={deposit.isPending}
                  onClick={() => void pay('deposit')}
                >
                  {deposit.isPending ? 'Đang chuyển sang cổng VNPay…' : 'Đặt cọc qua VNPay'}
                </Button>
              )}
              {(status === 'CONFIRMED' || status === 'CHECKED_OUT') && (
                <Button
                  variant="outline"
                  className="rounded-full px-6"
                  disabled={final.isPending}
                  aria-busy={final.isPending}
                  onClick={() => void pay('final')}
                >
                  {final.isPending ? 'Đang chuyển sang cổng VNPay…' : 'Thanh toán phần còn lại'}
                </Button>
              )}
              {status !== 'CHECKED_IN' && status !== 'CHECKED_OUT' && status !== 'ROOM_HELD' && (
                <Button
                  variant="ghost"
                  className="rounded-full text-destructive hover:bg-destructive/10"
                  onClick={() => setConfirmCancel(true)}
                >
                  Huỷ booking
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận huỷ booking</AlertDialogTitle>
            <AlertDialogDescription>
              Huỷ booking này? Phòng đang giữ sẽ được mở lại. Thao tác không thể hoàn tác.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Giữ lại</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void doCancel()}
              disabled={cancel.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Xác nhận huỷ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
