import { Link } from 'react-router'
import { Alert } from '@/components/Alert'
import { Button } from '@/components/Button'
import { getErrorMessage } from '@/lib/api-client'
import { formatDate } from '@/features/booking/utils'
import { revenueTime } from '@/features/reports/presentation'
import { DashboardCard } from '../components/DashboardCard'
import { useReceptionDashboard } from '../hooks'
import { RECEPTION_SHORTCUTS } from '../shortcuts'

const linkClass =
  'inline-flex min-h-11 items-center text-primary underline underline-offset-4 hover:text-primary-hover'
const number = (value: number) => value.toLocaleString('vi-VN')

function Rows({ rows }: { rows: { label: string; value: number }[] }) {
  return (
    <dl className="space-y-2">
      {rows.map((row) => (
        <div key={row.label} className="flex items-center justify-between gap-4">
          <dt>{row.label}</dt>
          <dd className="text-xl font-semibold tabular-nums">{number(row.value)}</dd>
        </div>
      ))}
    </dl>
  )
}

/** Reception Dashboard: tình hình hôm nay ở quầy và các việc đang chờ lễ tân. */
export function ReceptionDashboardPage() {
  const dashboard = useReceptionDashboard()
  const data = dashboard.data
  const refresh = () => void dashboard.refetch()
  const loading = dashboard.isFetching

  return (
    <section className="mx-auto max-w-container space-y-8 px-4 py-10 font-body">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-semibold">Tổng quan lễ tân</h1>
          <p className="mt-2 text-sm text-stone-700">
            {data?.frontDesk.available
              ? `Tình hình ngày ${formatDate(data.frontDesk.date)} và các việc đang chờ xử lý.`
              : 'Tình hình hôm nay và các việc đang chờ xử lý.'}
          </p>
        </div>
        <Button type="button" disabled={loading} onClick={refresh}>
          Làm mới
        </Button>
      </header>
      <p aria-live="polite" className="text-sm text-stone-700">
        {loading
          ? 'Đang cập nhật số liệu…'
          : data
            ? `Cập nhật lúc ${revenueTime(data.generatedAt)}`
            : ''}
      </p>

      {dashboard.isError ? (
        <Alert tone="danger">
          <p>{getErrorMessage(dashboard.error)}</p>
          <Button type="button" variant="secondary" onClick={refresh} disabled={loading}>
            Thử lại
          </Button>
        </Alert>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4" aria-busy={loading}>
          <DashboardCard
            id="reception-arrivals"
            title="Khách đến hôm nay"
            block={data?.frontDesk}
            loading={loading}
            retry={refresh}
          >
            {({ arrivals }) => (
              <>
                <Rows
                  rows={[
                    { label: 'Tổng', value: arrivals.total },
                    { label: 'Chưa cọc', value: arrivals.awaitingDeposit },
                    { label: 'Sẵn sàng nhận phòng', value: arrivals.ready },
                    { label: 'Đã nhận phòng', value: arrivals.checkedIn },
                  ]}
                />
                <Link className={linkClass} to="/reception/front-desk">
                  Xem danh sách đến và đi
                </Link>
              </>
            )}
          </DashboardCard>
          <DashboardCard
            id="reception-departures"
            title="Khách đi hôm nay"
            block={data?.frontDesk}
            loading={loading}
            retry={refresh}
          >
            {({ departures }) => (
              <>
                <Rows
                  rows={[
                    { label: 'Tổng', value: departures.total },
                    { label: 'Chờ trả phòng', value: departures.awaitingCheckOut },
                    { label: 'Đã trả phòng', value: departures.checkedOut },
                  ]}
                />
                <Link className={linkClass} to="/reception/front-desk">
                  Xem danh sách đến và đi
                </Link>
              </>
            )}
          </DashboardCard>
          <DashboardCard
            id="reception-rooms"
            title="Phòng hôm nay"
            block={data?.rooms}
            loading={loading}
            retry={refresh}
          >
            {(rooms) => (
              <>
                <Rows
                  rows={[
                    { label: 'Tổng số phòng', value: rooms.total },
                    { label: 'Trống', value: rooms.free },
                    { label: 'Giữ chỗ', value: rooms.held },
                    { label: 'Đã đặt', value: rooms.reserved },
                    { label: 'Đang ở', value: rooms.inHouse },
                    { label: 'Đang dọn', value: rooms.cleaning },
                    { label: 'Bảo trì', value: rooms.maintenance },
                  ]}
                />
                <Link className={linkClass} to="/reception/rooms">
                  Xem sơ đồ phòng
                </Link>
              </>
            )}
          </DashboardCard>
          <DashboardCard
            id="reception-requests"
            title="Việc cần xử lý"
            block={data?.requests}
            loading={loading}
            retry={refresh}
          >
            {(requests) => (
              <ul className="space-y-1">
                {[
                  {
                    to: '/staff/service-orders',
                    label: 'Yêu cầu dịch vụ chờ duyệt',
                    value: requests.serviceOrdersPendingReview,
                  },
                  {
                    to: '/staff/issues',
                    label: 'Sự cố chờ duyệt',
                    value: requests.issuesPendingReview,
                  },
                  {
                    to: '/staff/feedback',
                    label: 'Phản hồi chưa trả lời',
                    value: requests.feedbackUnreplied,
                  },
                ].map((item) => (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      className="flex min-h-11 items-center justify-between gap-4 text-primary hover:text-primary-hover"
                    >
                      <span className="underline underline-offset-4">{item.label}</span>
                      <strong className="text-xl tabular-nums">{number(item.value)}</strong>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </DashboardCard>
        </div>
      )}

      <nav aria-labelledby="reception-shortcuts-heading" className="space-y-4">
        <h2 id="reception-shortcuts-heading" className="text-2xl font-semibold">
          Lối tắt
        </h2>
        <ul className="flex flex-wrap gap-x-8 gap-y-1">
          {RECEPTION_SHORTCUTS.map((link) => (
            <li key={link.to}>
              <Link className={linkClass} to={link.to}>
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </section>
  )
}
