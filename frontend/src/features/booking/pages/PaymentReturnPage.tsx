import { Link } from 'react-router'
import { Alert } from '@/components/Alert'
import { Badge } from '@/components/Badge'
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

  // bookingId do server trả kèm kết quả Return (không cần localStorage): đọc lại trạng thái
  // thật và poll tới khi IPN chốt CONFIRMED, dùng được cả khi thanh toán ở thiết bị khác.
  const bookingId = verify.data?.bookingId
  const bookingQuery = useBooking(bookingId ?? '', {
    enabled: Boolean(bookingId),
    poll: true,
  })
  const booking = bookingQuery.data

  const payDisplay = verify.data ? PAYMENT_RESULT_DISPLAY[verify.data.status] : undefined
  const bookingDisplay = booking ? BOOKING_STATUS_DISPLAY[booking.status] : undefined

  return (
    <section className="mx-auto max-w-container space-y-6 px-4 py-16 text-center font-body">
      <p className="text-xs font-semibold tracking-widest text-primary uppercase">Thanh toán</p>
      <h1 className="font-display text-4xl font-semibold text-pearl-900">Kết quả thanh toán</h1>

      {!rawQuery && <Alert tone="warning">Không có dữ liệu thanh toán để hiển thị.</Alert>}
      {verify.isPending && rawQuery && <p role="status">Đang xác minh kết quả…</p>}
      {verify.isError && <Alert tone="danger">{getErrorMessage(verify.error)}</Alert>}

      {verify.data && payDisplay && (
        <div className="mx-auto max-w-md space-y-4 rounded-lg border border-stone-300 bg-white p-8">
          <Badge tone={payDisplay.tone}>{payDisplay.label}</Badge>
          <dl className="space-y-2 text-left text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-stone-700">Mã giao dịch</dt>
              <dd className="font-semibold break-all">{verify.data.transactionRef}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-stone-700">Mã phản hồi VNPay</dt>
              <dd className="font-semibold">{verify.data.responseCode}</dd>
            </div>
            {bookingDisplay && (
              <div className="flex items-center justify-between gap-4">
                <dt className="text-stone-700">Trạng thái đặt phòng</dt>
                <dd>
                  <Badge tone={bookingDisplay.tone}>{bookingDisplay.label}</Badge>
                </dd>
              </div>
            )}
          </dl>

          {verify.data.status === 'SUCCESS' &&
            (booking?.status === 'PENDING_DEPOSIT' || booking?.status === 'ROOM_HELD') && (
              <p className="text-sm text-stone-700" role="status">
                Hệ thống đang hoàn tất xác nhận booking từ cổng thanh toán. Trạng thái sẽ tự cập
                nhật trong giây lát.
              </p>
            )}
          {booking?.status === 'CONFIRMED' && (
            <p className="text-sm text-success">Đặt phòng của bạn đã được xác nhận.</p>
          )}
          {verify.data.status === 'SUCCESS' &&
            (booking?.status === 'EXPIRED' || booking?.status === 'CANCELLED') && (
              <Alert tone="warning">
                Chúng tôi đã nhận thanh toán nhưng phòng không còn được giữ (tiền về sau thời hạn
                giữ phòng). Khoản này sẽ được đối soát và hoàn lại; vui lòng liên hệ lễ tân để được
                hỗ trợ.
              </Alert>
            )}
          {(verify.data.status === 'FAILED' || verify.data.status === 'CANCELLED') && (
            <p className="text-sm text-stone-700">
              Thanh toán chưa hoàn tất. Nếu phòng vẫn đang được giữ, bạn có thể thử lại từ trang chi
              tiết booking.
            </p>
          )}
        </div>
      )}

      <div className="flex flex-wrap justify-center gap-4">
        {bookingId && (
          <Link to={`/booking/${bookingId}`} className="text-sm text-primary underline">
            Xem chi tiết booking
          </Link>
        )}
        <Link to="/my-bookings" className="text-sm text-primary underline">
          Đặt phòng của tôi
        </Link>
        <Link to="/" className="text-sm text-primary underline">
          Về trang chủ
        </Link>
      </div>
    </section>
  )
}
