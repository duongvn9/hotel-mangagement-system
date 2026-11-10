import { useState } from 'react'
import { CreditCard, XCircle } from 'lucide-react'
import { Navigate, useLocation, useParams, useSearchParams } from 'react-router'
import { Button, Input } from '@/components/atoms'
import { Alert, FormField } from '@/components/molecules'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  PageContainer,
  PageHeader,
} from '@/components/organisms'
import { Role } from '@/features/auth/api'
import { useAuth } from '@/features/auth/auth-context'
import { getErrorMessage } from '@/lib/api-client'
import { fshort } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { InitiatePaymentInput } from '../api'
import { BookingDetailLayout } from '../components/BookingDetailLayout'
import {
  useBooking,
  useBookingSummary,
  useCancelBooking,
  useInitiateDeposit,
  useInitiateFinal,
} from '../hooks'
import { formatRemaining, useHoldCountdown } from './useHoldCountdown'

/**
 * UC09/UC12/UC20/UC21 — chi tiết & thao tác với một booking. Trạng thái và hạn giữ phòng
 * đọc authoritative từ backend (GET /bookings/:id); localStorage chỉ là bộ nhớ đệm hiển thị.
 */
export function BookingDetailPage() {
  const { id = '' } = useParams()
  const [params] = useSearchParams()
  const { me } = useAuth()
  // /my-bookings/:id nằm trong khung dashboard của khách; /booking/:id là trang công khai.
  const inDashboard = useLocation().pathname.startsWith('/my-bookings/')

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

  // Khách vừa đặt xong đọc được booking qua phiên giữ phòng nên URL chưa có ?code.
  const guestCode = code || booking?.code

  // Số liệu chi tiết chỉ đọc sau khi đã có quyền đọc booking; khách vãng lai gửi mã booking.
  const summary = useBookingSummary(booking ? id : '', me ? {} : { code: guestCode })

  function payload(): InitiatePaymentInput {
    return { bookingId: id, ...(me ? {} : { code: guestCode }) }
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
      await cancel.mutateAsync({ id, ...(me ? {} : { code: guestCode }) })
      setConfirmCancel(false)
      await Promise.all([query.refetch(), summary.refetch()])
    } catch {
      // Lỗi hiển thị qua cancel.isError.
    }
  }

  // Lễ tân/Quản lý xem booking trong khung dashboard (trang chi tiết dành cho nhân viên), không ở trang công khai của khách.
  if (me && (me.role === Role.Receptionist || me.role === Role.Manager) && booking?.code) {
    return <Navigate to={`/reception/bookings/${encodeURIComponent(booking.code)}`} replace />
  }
  // Khách đăng nhập xem booking trong khung dashboard của khách; khách vãng lai vẫn ở trang công khai.
  if (me?.role === Role.Customer && !inDashboard) {
    return <Navigate to={`/my-bookings/${encodeURIComponent(id)}`} replace />
  }

  const errors = [deposit, final, cancel].filter((mutation) => mutation.isError)
  const alertClass = 'rounded-xl border p-4 text-sm'

  const notices = (
    <div className="space-y-3">
      {holding && !holdExpired && remaining !== null && (
        <div className={cn(alertClass, 'border-primary/20 bg-primary/10 text-foreground')}>
          Phòng đang được giữ. Vui lòng đặt cọc trong <strong>{formatRemaining(remaining)}</strong>,
          nếu không phòng sẽ được mở lại.
        </div>
      )}
      {holding && holdExpired && (
        <div
          role="alert"
          className={cn(alertClass, 'border-destructive/20 bg-destructive/10 text-destructive')}
        >
          Đã quá thời gian giữ phòng. Trạng thái sẽ sớm chuyển sang hết hạn; vui lòng tìm phòng lại
          nếu bạn vẫn muốn đặt.
        </div>
      )}
      {expired && (
        <div
          role="alert"
          className={cn(alertClass, 'border-destructive/20 bg-destructive/10 text-destructive')}
        >
          Đơn đã hết hạn giữ phòng và phòng đã được mở lại. Vui lòng tìm phòng để đặt lại.
        </div>
      )}
      {cancelled && (
        <div
          role="alert"
          className={cn(alertClass, 'border-success/20 bg-success/10 text-success')}
        >
          Booking đã được huỷ và phòng đã được mở lại.
        </div>
      )}
      {booking?.holdExpiresAt && holding && (
        <p className="text-xs text-muted-foreground">
          Giữ phòng đến {fshort(booking.holdExpiresAt)}
        </p>
      )}
      {errors.map((mutation, index) => (
        <div
          key={index}
          role="alert"
          className={cn(alertClass, 'border-destructive/20 bg-destructive/10 text-destructive')}
        >
          {getErrorMessage(mutation.error)}
        </div>
      ))}
    </div>
  )

  const actions =
    !cancelled && !expired ? (
      <>
        {status === 'PENDING_DEPOSIT' && (
          <Button
            className="rounded-full"
            disabled={holdExpired || deposit.isPending}
            aria-busy={deposit.isPending}
            onClick={() => void pay('deposit')}
          >
            <CreditCard className="size-4" />
            {deposit.isPending ? 'Đang chuyển sang cổng VNPay…' : 'Đặt cọc qua VNPay'}
          </Button>
        )}
        {(status === 'CONFIRMED' || status === 'CHECKED_OUT') && (
          <Button
            variant="outline"
            className="rounded-full"
            disabled={final.isPending}
            aria-busy={final.isPending}
            onClick={() => void pay('final')}
          >
            <CreditCard className="size-4" />
            {final.isPending ? 'Đang chuyển sang cổng VNPay…' : 'Thanh toán phần còn lại'}
          </Button>
        )}
        {status !== 'CHECKED_IN' && status !== 'CHECKED_OUT' && status !== 'ROOM_HELD' && (
          <Button
            variant="ghost"
            className="rounded-full text-destructive hover:bg-destructive/10"
            onClick={() => setConfirmCancel(true)}
          >
            <XCircle className="size-4" />
            Huỷ booking
          </Button>
        )}
      </>
    ) : undefined

  return (
    <PageContainer className="space-y-6">
      {summary.data ? (
        <BookingDetailLayout
          summary={summary.data}
          backTo={me ? '/my-bookings' : '/booking/lookup'}
          backLabel={me ? 'Đặt phòng' : 'Tra cứu đặt phòng'}
          actions={actions}
          notices={notices}
        />
      ) : (
        <PageHeader eyebrow="Đặt phòng" title="Chi tiết đặt phòng" />
      )}

      {(query.isPending || (booking && summary.isPending)) && !needsCode && (
        <div role="status" className="py-12">
          <p className="text-muted-foreground">Đang tải thông tin đặt phòng…</p>
        </div>
      )}

      {query.isError && !needsCode && (
        <Alert tone="danger">
          {getErrorMessage(query.error, 'Không đọc được thông tin đặt phòng.')}
        </Alert>
      )}
      {summary.isError && (
        <Alert tone="danger">
          {getErrorMessage(summary.error, 'Không đọc được chi tiết đặt phòng.')}
        </Alert>
      )}

      {needsCode && (
        <div className="max-w-md space-y-4">
          <Alert tone="info">
            Nhập mã booking (vé) đã nhận để xem và thao tác với đơn này trên thiết bị hiện tại.
          </Alert>
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
    </PageContainer>
  )
}
