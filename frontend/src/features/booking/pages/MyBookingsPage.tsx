import { Link } from 'react-router'
import { Button, StatusBadge } from '@/components/atoms'
import { EmptyState } from '@/components/molecules'
import { PageHeader } from '@/components/organisms'
import { getErrorMessage } from '@/lib/api-client'
import { fdate, vnd } from '@/lib/format'
import { useMyBookings } from '../hooks'

/**
 * UC09/UC10 — "Đặt phòng của tôi" cho Customer đăng nhập: đọc booking gắn với tài khoản
 * từ server (GET /bookings/mine). Màn này yêu cầu đăng nhập (RequireAuth ở route); khách
 * vãng lai tra cứu đơn bằng mã ở trang /booking/lookup.
 */
export function MyBookingsPage() {
  const query = useMyBookings()
  const bookings = query.data ?? []

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-5 py-10 lg:px-8">
      <PageHeader
        title="Đặt phòng của tôi"
        subtitle="Xem, theo dõi và quản lý các đơn đặt phòng của bạn."
        actions={
          <Button asChild className="rounded-full">
            <Link to="/search">Tìm phòng mới</Link>
          </Button>
        }
      />

      {query.isPending && (
        <div role="status" className="py-8">
          <p className="text-muted-foreground">Đang tải đặt phòng của bạn…</p>
        </div>
      )}

      {query.isError && (
        <div
          role="alert"
          className="rounded-xl border border-destructive/20 bg-destructive/10 p-5 text-destructive"
        >
          {getErrorMessage(query.error, 'Không tải được danh sách đặt phòng.')}
        </div>
      )}

      {query.isSuccess && bookings.length === 0 && (
        <EmptyState
          title="Bạn chưa có đặt phòng nào"
          body="Hãy tìm phòng để bắt đầu kỳ nghỉ tuyệt vời cùng Emily Hotel."
          action={
            <Button asChild className="rounded-full">
              <Link to="/search">Đặt phòng ngay</Link>
            </Button>
          }
        />
      )}

      {bookings.length > 0 && (
        <div className="grid gap-4">
          {bookings.map((booking) => (
            <Link
              key={booking.id}
              to={`/booking/${booking.id}`}
              className="card-soft flex flex-col gap-4 p-5 transition hover:shadow-lift sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <span className="font-semibold tracking-wide text-foreground">
                    {booking.code}
                  </span>
                  <StatusBadge status={booking.status} />
                </div>
                <p className="text-sm text-muted-foreground">
                  {fdate(booking.checkIn)} → {fdate(booking.checkOut)} · {booking.roomCount} phòng ·{' '}
                  {booking.adultCount + booking.childCount} khách
                </p>
              </div>
              <div className="sm:text-right">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Tiền cọc</p>
                <p className="font-semibold text-primary tabular-nums">
                  {vnd(booking.depositAmount)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
