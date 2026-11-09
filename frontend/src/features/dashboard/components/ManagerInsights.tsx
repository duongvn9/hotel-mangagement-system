import { Link } from 'react-router'
import { BedDouble, TrendingUp, CalendarDays, Star } from 'lucide-react'
import { StatusBadge } from '@/components/atoms'
import { EmptyState, StatCard } from '@/components/molecules'
import { Donut, Panel, RevenueArea } from '@/components/organisms'
import { ROOM_STATUSES, ROOM_STATUS_DISPLAY } from '@/features/rooms/api'
import { revenueMoney } from '@/features/reports/presentation'
import type { DashboardInsights, ManagerDashboard } from '../api'

const unavailable = 'Chưa có dữ liệu nguồn'
const shortDay = (value: string) => {
  const parts = new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).formatToParts(new Date(value))
  return `${parts.find((part) => part.type === 'day')?.value}/${parts.find((part) => part.type === 'month')?.value}`
}

export function ManagerInsights({
  insights,
  rooms,
}: {
  insights: DashboardInsights
  rooms?: ManagerDashboard['rooms']
}) {
  const revenue = insights.revenue
  const bookings = insights.bookings
  const feedback = insights.feedback
  const occupancy =
    rooms?.available && rooms.activeTotal > 0
      ? `${Math.round((rooms.byStatus.OCCUPIED / rooms.activeTotal) * 100)}%`
      : '—'
  const trend =
    revenue.available && revenue.changePercent !== null
      ? `${revenue.changePercent > 0 ? '+' : ''}${revenue.changePercent.toFixed(1)}%`
      : undefined
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 [&>.card-soft]:min-w-0 [&>.card-soft]:break-words">
        <StatCard
          label="Công suất phòng"
          value={occupancy}
          hint={
            rooms?.available
              ? `${rooms.byStatus.OCCUPIED} / ${rooms.activeTotal} phòng`
              : unavailable
          }
          icon={BedDouble}
        />
        <StatCard
          label="Doanh thu · 14 ngày"
          value={revenue.available ? revenueMoney(revenue.amount) : '—'}
          trend={trend}
          hint={
            revenue.available
              ? trend
                ? 'so với kỳ trước'
                : 'Chưa có cơ sở so sánh kỳ trước'
              : unavailable
          }
          icon={TrendingUp}
        />
        <StatCard
          label="Đặt phòng đang hiệu lực"
          value={bookings.available ? bookings.activeCount : '—'}
          hint={bookings.available ? undefined : unavailable}
          icon={CalendarDays}
        />
        <StatCard
          label="Điểm đánh giá"
          value={
            feedback.available && feedback.average !== null ? feedback.average.toFixed(1) : '—'
          }
          hint={feedback.available ? `${feedback.count} đánh giá có chấm sao` : unavailable}
          icon={Star}
        />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_23.75rem]">
        <Panel
          title="Doanh thu"
          className="min-w-0"
          action={
            <Link
              to="/manager/reports/revenue"
              className="text-xs text-primary focus-visible:outline-2 focus-visible:outline-ring"
            >
              Xem báo cáo →
            </Link>
          }
        >
          {revenue.available ? (
            <RevenueArea
              animate={false}
              series={revenue.series.map((row) => ({ d: shortDay(row.day), revenue: row.revenue }))}
            />
          ) : (
            <EmptyState title={unavailable} />
          )}
        </Panel>
        <Panel
          title="Trạng thái phòng"
          className="min-w-0"
          action={
            <Link
              to="/reception/rooms"
              className="text-xs text-primary focus-visible:outline-2 focus-visible:outline-ring"
            >
              Xem sơ đồ →
            </Link>
          }
        >
          {rooms?.available ? (
            <Donut
              data={ROOM_STATUSES.map((status) => ({
                name: ROOM_STATUS_DISPLAY[status].label,
                value: rooms.byStatus[status],
              }))}
            />
          ) : (
            <EmptyState title={unavailable} />
          )}
        </Panel>
      </div>
      <Panel
        title="Đặt phòng mới nhất"
        className="mt-6"
        action={
          <Link
            to="/reception/bookings"
            className="text-xs text-primary focus-visible:outline-2 focus-visible:outline-ring"
          >
            Tất cả đặt phòng →
          </Link>
        }
      >
        {bookings.available && bookings.recent.length ? (
          <div className="divide-y">
            {bookings.recent.map((booking) => (
              <Link
                key={booking.id}
                to={`/reception/bookings/${encodeURIComponent(booking.code)}`}
                className="grid grid-cols-2 items-center gap-2 py-3 text-sm hover:text-primary focus-visible:outline-2 focus-visible:outline-ring sm:grid-cols-5"
              >
                <span className="min-w-0 break-words font-medium">{booking.code}</span>
                <span className="min-w-0 break-words">
                  {booking.guestName || 'Chưa có thông tin khách'}
                </span>
                <span className="hidden min-w-0 break-words sm:block">
                  Phòng {booking.rooms.join(', ') || '—'}
                </span>
                <span className="hidden sm:block">
                  {shortDay(booking.checkIn)} → {shortDay(booking.checkOut)}
                </span>
                <span className="sm:text-right">
                  <StatusBadge status={booking.status} />
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState title={bookings.available ? 'Chưa có đặt phòng' : unavailable} />
        )}
      </Panel>
    </>
  )
}
