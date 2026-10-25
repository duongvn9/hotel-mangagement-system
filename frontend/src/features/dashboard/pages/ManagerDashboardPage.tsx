import { Link } from 'react-router'
import { Alert } from '@/components/Alert'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { getErrorMessage } from '@/lib/api-client'
import { ROOM_STATUSES, ROOM_STATUS_DISPLAY } from '@/features/rooms/api'
import { displayReportDay, revenueMoney, revenueTime } from '@/features/reports/presentation'
import { useManagerDashboard } from '../hooks'
import { DashboardCard } from '../components/DashboardCard'
import { MANAGER_SHORTCUTS } from '../shortcuts'
const linkClass =
  'inline-flex min-h-11 items-center text-primary underline underline-offset-4 hover:text-primary-hover'
export function ManagerDashboardPage() {
  const dashboard = useManagerDashboard(),
    data = dashboard.data
  const refresh = () => void dashboard.refetch()
  return (
    <section className="mx-auto max-w-container space-y-8 px-4 py-10 font-body">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-semibold">Tổng quan</h1>
          <p className="mt-2 text-sm text-stone-700">
            Giám sát công việc, trạng thái phòng và tiền thực thu hiện tại.
          </p>
        </div>
        <Button type="button" disabled={dashboard.isFetching} onClick={refresh}>
          Làm mới
        </Button>
      </header>
      <p aria-live="polite" className="text-sm text-stone-700">
        {dashboard.isFetching
          ? 'Đang cập nhật số liệu…'
          : data
            ? `Cập nhật lúc ${revenueTime(data.generatedAt)}`
            : ''}
      </p>
      {dashboard.isError ? (
        <Alert tone="danger">
          <p>{getErrorMessage(dashboard.error)}</p>
          <Button
            type="button"
            variant="secondary"
            onClick={refresh}
            disabled={dashboard.isFetching}
          >
            Thử lại
          </Button>
        </Alert>
      ) : (
        <section aria-labelledby="current-dashboard-heading" className="space-y-4">
          <h2 id="current-dashboard-heading" className="text-2xl font-semibold">
            Số liệu hiện tại
          </h2>
          <div
            className="grid gap-4 lg:grid-cols-3"
            aria-live="polite"
            aria-busy={dashboard.isFetching}
          >
            <DashboardCard
              id="dashboard-tasks"
              title="Hàng đợi task"
              block={data?.tasks}
              loading={dashboard.isFetching}
              retry={refresh}
            >
              {(tasks) => (
                <>
                  <dl className="space-y-2">
                    {(
                      [
                        { key: 'assigned', label: 'Đã giao' },
                        { key: 'inProgress', label: 'Đang xử lý' },
                        { key: 'completed', label: 'Hoàn thành' },
                      ] as const
                    ).map((row) => (
                      <div key={row.key} className="flex items-center justify-between gap-4">
                        <dt>{row.label}</dt>
                        <dd className="text-xl font-semibold tabular-nums">
                          {tasks.counts[row.key].toLocaleString('vi-VN')}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  <Badge tone="warning">Quá hạn: {tasks.overdue.toLocaleString('vi-VN')}</Badge>
                  <p>
                    <Link className={linkClass} to="/manager/task-queues">
                      Xem hàng đợi task
                    </Link>
                  </p>
                </>
              )}
            </DashboardCard>
            <DashboardCard
              id="dashboard-rooms"
              title="Trạng thái phòng"
              block={data?.rooms}
              loading={dashboard.isFetching}
              retry={refresh}
            >
              {(rooms) => (
                <>
                  <p className="flex justify-between gap-4">
                    <span>Phòng hoạt động</span>
                    <strong className="text-xl tabular-nums">
                      {rooms.activeTotal.toLocaleString('vi-VN')}
                    </strong>
                  </p>
                  <dl className="space-y-2">
                    {ROOM_STATUSES.map((status) => (
                      <div key={status} className="flex items-center justify-between gap-4">
                        <dt>{ROOM_STATUS_DISPLAY[status].label}</dt>
                        <dd className="font-semibold tabular-nums">
                          {rooms.byStatus[status].toLocaleString('vi-VN')}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  <p className="text-sm text-stone-700">
                    Ảnh chụp hiện tại lúc {revenueTime(rooms.asOf)}.
                  </p>
                  <Link className={linkClass} to="/manager/rooms">
                    Xem phòng
                  </Link>
                </>
              )}
            </DashboardCard>
            <DashboardCard
              id="dashboard-revenue"
              title="Thực thu tháng này"
              block={data?.revenue}
              loading={dashboard.isFetching}
              retry={refresh}
            >
              {(revenue) => (
                <>
                  <p className="text-sm text-stone-700">Thực thu (giao dịch thành công)</p>
                  <p className="break-words text-2xl font-semibold tabular-nums">
                    {revenueMoney(revenue.successAmount)}
                  </p>
                  <p>Giao dịch thành công: {revenue.successCount.toLocaleString('vi-VN')}</p>
                  <p className="text-sm text-stone-700">
                    {displayReportDay(revenue.period.from)}–{displayReportDay(revenue.period.to)}
                  </p>
                  <Link
                    className={linkClass}
                    to={`/manager/reports/revenue?from=${revenue.period.from}&to=${revenue.period.to}&granularity=day`}
                  >
                    Xem báo cáo doanh thu
                  </Link>
                </>
              )}
            </DashboardCard>
          </div>
        </section>
      )}
      <nav aria-labelledby="manager-shortcuts-heading" className="space-y-4">
        <h2 id="manager-shortcuts-heading" className="text-2xl font-semibold">
          Lối tắt
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {MANAGER_SHORTCUTS.map((group) => (
            <section
              key={group.title}
              aria-label={group.title}
              className="min-w-0 rounded border border-stone-300 p-4"
            >
              <h3 className="mb-2 font-semibold">{group.title}</h3>
              <ul>
                {group.links.map((link) => (
                  <li key={link.to}>
                    <Link className={linkClass} to={link.to}>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </nav>
    </section>
  )
}
