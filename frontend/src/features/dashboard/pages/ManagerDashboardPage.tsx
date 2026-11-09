import { Link } from 'react-router'
import { Badge, Button, Skeleton } from '@/components/atoms'
import { Alert } from '@/components/molecules'
import { PageContainer, PageHeader, Panel } from '@/components/organisms'
import { env } from '@/lib/env'
import { getErrorMessage } from '@/lib/api-client'
import { ROOM_STATUSES, ROOM_STATUS_DISPLAY } from '@/features/rooms/api'
import { displayReportDay, revenueMoney, revenueTime } from '@/features/reports/presentation'
import { useManagerDashboard } from '../hooks'
import { DashboardCard } from '../components/DashboardCard'
import { MANAGER_SHORTCUTS } from '../shortcuts'
import { ManagerInsights } from '../components/ManagerInsights'
const linkClass =
  'inline-flex min-h-11 w-full items-center justify-center rounded-full border border-border bg-card px-3 py-2.5 text-center text-sm leading-snug font-medium text-primary transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'
export function ManagerDashboardPage() {
  const dashboard = useManagerDashboard(),
    data = dashboard.data
  const refresh = () => void dashboard.refetch()
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Tổng quan"
        title="Tổng quan"
        subtitle={`14 ngày gần nhất tại ${env.appName}.`}
        actions={
          <Button
            className="rounded-full"
            type="button"
            disabled={dashboard.isFetching}
            onClick={refresh}
          >
            Làm mới
          </Button>
        }
      />
      <p aria-live="polite" className="mb-4 text-sm text-muted-foreground">
        {dashboard.isFetching
          ? 'Đang cập nhật số liệu…'
          : data
            ? `Cập nhật lúc ${revenueTime(data.generatedAt)}`
            : ''}
      </p>
      {data?.insights && !dashboard.isError && (
        <ManagerInsights insights={data.insights} rooms={data.rooms} />
      )}
      {!data && !dashboard.isError && (
        <div aria-label="Đang tải tổng quan" aria-busy="true" className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-36 rounded-xl" />
            ))}
          </div>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_23.75rem]">
            <Skeleton className="h-80 rounded-xl" />
            <Skeleton className="h-80 rounded-xl" />
          </div>
          <Skeleton className="h-64 rounded-xl" />
        </div>
      )}
      <details open={!data?.insights || dashboard.isError} className="mt-6 space-y-6">
        <summary className="cursor-pointer text-sm font-medium focus-visible:outline-2 focus-visible:outline-ring">
          Số liệu hiện tại và lối tắt
        </summary>
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
                    <p className="text-sm text-muted-foreground">
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
                    <p className="text-sm text-muted-foreground">Thực thu (giao dịch thành công)</p>
                    <p className="break-words text-2xl font-semibold tabular-nums">
                      {revenueMoney(revenue.successAmount)}
                    </p>
                    <p>Giao dịch thành công: {revenue.successCount.toLocaleString('vi-VN')}</p>
                    <p className="text-sm text-muted-foreground">
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
              <section key={group.title} aria-label={group.title} className="min-w-0">
                <Panel title={group.title}>
                  <ul className="space-y-2">
                    {group.links.map((link) => (
                      <li key={link.to}>
                        <Link className={linkClass} to={link.to}>
                          {link.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </Panel>
              </section>
            ))}
          </div>
        </nav>
      </details>
    </PageContainer>
  )
}
