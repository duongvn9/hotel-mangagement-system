import { useEffect, useRef } from 'react'
import { Link } from 'react-router'
import { Alert } from '@/components/Alert'
import { Badge } from '@/components/Badge'
import { getErrorMessage } from '@/lib/api-client'
import { PAYMENT_RESULT_DISPLAY } from '../api'
import { useVerifyReturn } from '../hooks'
import { lookupPaymentRef, patchStoredBooking } from '../storage'

/**
 * Đích VNPay redirect về sau khi thanh toán (cấu hình VNPAY_RETURN_URL trỏ tới /payment/return).
 * Chỉ để hiển thị kết quả — việc chốt thanh toán thật do IPN của backend xử lý.
 */
export function PaymentReturnPage() {
  const rawQuery = window.location.search.replace(/^\?/, '')
  const verify = useVerifyReturn(rawQuery)
  const applied = useRef(false)

  const bookingId = verify.data && lookupPaymentRef(verify.data.transactionRef)

  // Cập nhật trạng thái booking đã lưu ở client theo kết quả quan sát được.
  useEffect(() => {
    if (!verify.data || applied.current) return
    const id = lookupPaymentRef(verify.data.transactionRef)
    if (!id) return
    applied.current = true
    patchStoredBooking(id, {
      depositResult: verify.data.status,
      ...(verify.data.status === 'SUCCESS' ? { status: 'CONFIRMED' } : {}),
    })
  }, [verify.data])

  const display = verify.data ? PAYMENT_RESULT_DISPLAY[verify.data.status] : undefined

  return (
    <section className="mx-auto max-w-container space-y-6 px-4 py-16 text-center font-body">
      <p className="text-xs font-semibold tracking-widest text-primary uppercase">Thanh toán</p>
      <h1 className="font-display text-4xl font-semibold text-pearl-900">Kết quả thanh toán</h1>

      {!rawQuery && <Alert tone="warning">Không có dữ liệu thanh toán để hiển thị.</Alert>}
      {verify.isPending && rawQuery && <p role="status">Đang xác minh kết quả…</p>}
      {verify.isError && <Alert tone="danger">{getErrorMessage(verify.error)}</Alert>}

      {verify.data && display && (
        <div className="mx-auto max-w-md space-y-4 rounded-lg border border-stone-300 bg-white p-8">
          <Badge tone={display.tone}>{display.label}</Badge>
          <dl className="space-y-2 text-left text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-stone-700">Mã giao dịch</dt>
              <dd className="font-semibold break-all">{verify.data.transactionRef}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-stone-700">Mã phản hồi VNPay</dt>
              <dd className="font-semibold">{verify.data.responseCode}</dd>
            </div>
          </dl>
          {verify.data.status === 'SUCCESS' && (
            <p className="text-sm text-stone-700">
              Hệ thống đang hoàn tất xác nhận booking. Trạng thái cuối cùng sẽ được cập nhật trong
              giây lát.
            </p>
          )}
          {(verify.data.status === 'FAILED' || verify.data.status === 'CANCELLED') && (
            <p className="text-sm text-stone-700">
              Thanh toán chưa hoàn tất. Bạn có thể thử lại từ trang chi tiết booking.
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
