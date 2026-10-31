import { Link } from 'react-router'
import { Alert } from '@/components/Alert'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { getErrorMessage } from '@/lib/api-client'
import { BOOKING_STATUS_DISPLAY } from '../api'
import { useMyBookings } from '../hooks'
import { formatDate, money } from '../utils'

/**
 * UC09/UC10 — "Đặt phòng của tôi" cho Customer đăng nhập: đọc booking gắn với tài khoản
 * từ server (GET /bookings/mine). Màn này yêu cầu đăng nhập (RequireAuth ở route); khách
 * vãng lai tra cứu đơn bằng mã ở trang /booking/lookup.
 */
export function MyBookingsPage() {
  const query = useMyBookings()
  const bookings = query.data ?? []

  return (
    <section className="mx-auto max-w-container space-y-8 px-4 py-10 font-body">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-widest text-primary uppercase">Đặt phòng</p>
          <h1 className="font-display text-4xl font-semibold text-pearl-900">Đặt phòng của tôi</h1>
        </div>
        <Link to="/search">
          <Button>Tìm phòng mới</Button>
        </Link>
      </div>

      {query.isPending && <p role="status">Đang tải đặt phòng của bạn…</p>}

      {query.isError && (
        <Alert tone="danger">
          {getErrorMessage(query.error, 'Không tải được danh sách đặt phòng.')}
        </Alert>
      )}

      {query.isSuccess && bookings.length === 0 && (
        <p className="rounded-lg border border-stone-300 bg-white p-6 text-stone-700">
          Bạn chưa có đặt phòng nào. Hãy tìm phòng để bắt đầu.
        </p>
      )}

      {bookings.length > 0 && (
        <ul className="space-y-3">
          {bookings.map((booking) => {
            const display = BOOKING_STATUS_DISPLAY[booking.status] ?? {
              label: booking.status,
              tone: 'neutral' as const,
            }
            return (
              <li key={booking.id}>
                <Link
                  to={`/booking/${booking.id}`}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-stone-300 bg-white p-5 hover:bg-cream-50"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-semibold tracking-wide text-pearl-900">
                        {booking.code}
                      </span>
                      <Badge tone={display.tone}>{display.label}</Badge>
                    </div>
                    <p className="text-sm text-stone-700">
                      {formatDate(booking.checkIn)} → {formatDate(booking.checkOut)} ·{' '}
                      {booking.roomCount} phòng · {booking.adultCount + booking.childCount} khách
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs tracking-wider text-stone-700 uppercase">Tiền cọc</p>
                    <p className="font-semibold whitespace-nowrap text-primary tabular-nums">
                      {money.format(booking.depositAmount)}
                    </p>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
