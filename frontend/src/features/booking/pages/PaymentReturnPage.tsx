import { Link } from 'react-router'
import { CheckCircle2, XCircle } from 'lucide-react'
import { Button, StatusBadge } from '@/components/atoms'
import { KeyValue } from '@/components/molecules'
import { getErrorMessage } from '@/lib/api-client'
import { BOOKING_STATUS_DISPLAY, PAYMENT_RESULT_DISPLAY } from '../api'
import { useBooking, useVerifyReturn } from '../hooks'

/**
 * Đích VNPay redirect về sau khi thanh toán. Trang Return CHỈ hiển thị — bằng chứng confirm
 * thật là trạng thái Booking authoritative từ backend (IPN chốt), không coi redirect là đã xong.
 */
export function PaymentReturnPage() {
  const rawQuery = window.location.search.replace(/^\?/, '')
  const verify = useVerifyReturn(rawQuery)

  const bookingId = verify.data?.bookingId
  const bookingQuery = useBooking(bookingId ?? '', {
    enabled: Boolean(bookingId),
    poll: true,
  })
  const booking = bookingQuery.data

  const payDisplay = verify.data ? PAYMENT_RESULT_DISPLAY[verify.data.status] : undefined
  const bookingDisplay = booking ? BOOKING_STATUS_DISPLAY[booking.status] : undefined

  const isSuccess = verify.data?.status === 'SUCCESS'
  const isFinal = verify.data?.purpose === 'FINAL'

  return (
    <div className="mx-auto max-w-xl px-5 py-16">
      <div className="card-soft p-8 text-center">
        {verify.data && (
          <div className="mb-4 flex justify-center">
            {isSuccess ? (
              <CheckCircle2 className="size-16 text-success" />
            ) : (
              <XCircle className="size-16 text-destructive" />
            )}
          </div>
        )}

        <p className="text-xs font-semibold tracking-widest text-primary uppercase">Thanh toán</p>
        <h1 className="mt-2 font-display text-4xl font-semibold">
          {verify.data
            ? isSuccess
              ? isFinal
                ? 'Thanh toán thành công.'
                : 'Đặt phòng thành công.'
              : 'Thanh toán chưa thành công'
            : 'Kết quả thanh toán'}
        </h1>

        {!rawQuery && (
          <div
            role="alert"
            className="mt-6 rounded-xl border border-warning/20 bg-warning/10 p-4 text-warning"
          >
            Không có dữ liệu thanh toán để hiển thị.
          </div>
        )}

        {verify.isPending && rawQuery && (
          <p role="status" className="mt-4 text-muted-foreground">
            Đang xác minh kết quả…
          </p>
        )}

        {verify.isError && (
          <div
            role="alert"
            className="mt-6 rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-destructive"
          >
            {getErrorMessage(verify.error)}
          </div>
        )}

        {verify.data && payDisplay && (
          <div className="mt-8 space-y-6 text-left">
            <div className="divide-y divide-border rounded-xl border border-border p-4">
              <KeyValue k="Kết quả giao dịch" v={<StatusBadge status={verify.data.status} />} />
              <KeyValue
                k="Mã giao dịch"
                v={
                  <span className="font-mono text-xs break-all">{verify.data.transactionRef}</span>
                }
              />
              <KeyValue k="Mã phản hồi VNPay" v={verify.data.responseCode} />
              {bookingDisplay && (
                <KeyValue
                  k="Trạng thái đặt phòng"
                  v={<StatusBadge status={booking?.status ?? ''} />}
                />
              )}
            </div>

            {isSuccess && isFinal && (
              <p className="text-center text-sm font-medium text-success">
                Chúng tôi đã nhận khoản thanh toán còn lại của booking.
              </p>
            )}
            {verify.data.status === 'SUCCESS' &&
              !isFinal &&
              (booking?.status === 'PENDING_DEPOSIT' || booking?.status === 'ROOM_HELD') && (
                <p className="text-center text-sm text-muted-foreground" role="status">
                  Hệ thống đang hoàn tất xác nhận booking từ cổng thanh toán. Trạng thái sẽ tự cập
                  nhật trong giây lát.
                </p>
              )}
            {!isFinal && booking?.status === 'CONFIRMED' && (
              <p className="text-center text-sm font-medium text-success">
                Đặt phòng của bạn đã được xác nhận.
              </p>
            )}
            {verify.data.status === 'SUCCESS' &&
              !isFinal &&
              (booking?.status === 'EXPIRED' || booking?.status === 'CANCELLED') && (
                <div
                  role="alert"
                  className="rounded-xl border border-warning/20 bg-warning/10 p-4 text-sm text-foreground"
                >
                  Chúng tôi đã nhận thanh toán nhưng phòng không còn được giữ (tiền về sau thời hạn
                  giữ phòng). Khoản này sẽ được đối soát và hoàn lại; vui lòng liên hệ lễ tân để
                  được hỗ trợ.
                </div>
              )}
            {(verify.data.status === 'FAILED' || verify.data.status === 'CANCELLED') && (
              <p className="text-center text-sm text-muted-foreground">
                {isFinal
                  ? 'Thanh toán chưa hoàn tất. Bạn có thể thử lại từ trang chi tiết booking.'
                  : 'Thanh toán chưa hoàn tất. Nếu phòng vẫn đang được giữ, bạn có thể thử lại từ trang chi tiết booking.'}
              </p>
            )}
          </div>
        )}

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {bookingId && (
            <Button asChild className="rounded-full">
              <Link to={`/booking/${bookingId}`}>Xem chi tiết booking</Link>
            </Button>
          )}
          <Button asChild variant="outline" className="rounded-full">
            <Link to="/my-bookings">Đặt phòng của tôi</Link>
          </Button>
          <Button asChild variant="ghost" className="rounded-full">
            <Link to="/">Về trang chủ</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
