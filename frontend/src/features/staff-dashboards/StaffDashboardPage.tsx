import { Link } from 'react-router'
import { useAuth } from '@/features/auth/auth-context'
import { TaskError, TaskPriorityBadge, TaskStatusBadge } from '@/features/tasks/TaskPresentation'
import { taskDate } from '@/features/tasks/presentation'
import { Button } from '@/components/Button'
import { DashboardReadError, summarizeDashboard } from './api'
import { Alert } from '@/components/Alert'
import { useStaffDashboard } from './hooks'

const linkClass =
  'inline-flex min-h-11 items-center rounded-md text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary'

function StaffDashboardPage({ operations }: { operations: boolean }) {
  const { me } = useAuth()
  const query = useStaffDashboard()
  const data = query.data
  const summary = data ? summarizeDashboard(data) : undefined
  const metrics =
    data && summary
      ? ([
          ['Đã giao', data.counts.ASSIGNED],
          ['Đang thực hiện', data.counts.IN_PROGRESS],
          ['Hoàn thành', data.counts.COMPLETED],
          ['Sắp đến hạn (24 giờ tới)', summary.nearDue],
          ['Quá hạn', summary.overdue],
        ] as const)
      : []

  return (
    <section
      className="mx-auto max-w-container space-y-6 px-4 py-8 sm:px-6"
      aria-labelledby="dashboard-title"
    >
      <header className="space-y-3">
        <h1 id="dashboard-title" className="font-display text-4xl font-semibold text-pearl-900">
          {operations ? 'Bảng điều khiển vận hành' : 'Bảng điều khiển dịch vụ'}
        </h1>
        <p className="break-words text-stone-700">
          Xin chào {me?.fullName}.{' '}
          {operations
            ? 'Theo dõi công việc vận hành, bảo trì và xử lý sự cố được giao cho bạn.'
            : 'Theo dõi công việc phục vụ và xử lý sự cố được giao cho bạn.'}
        </p>
        <nav aria-label="Thao tác nhân viên" className="flex flex-wrap gap-x-6 gap-y-2">
          <Link className={linkClass} to="/staff/tasks">
            Xem công việc được giao
          </Link>
          <Link className={linkClass} to="/profile">
            Cập nhật hồ sơ
          </Link>
        </nav>
      </header>
      {query.isPending ? (
        <p role="status" className="text-stone-700">
          Đang tải bảng điều khiển…
        </p>
      ) : query.isError && query.error instanceof DashboardReadError ? (
        <div className="space-y-3">
          <Alert tone="danger">{query.error.message}</Alert>
          <Button
            variant="secondary"
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
          >
            Thử lại
          </Button>
        </div>
      ) : query.isError ? (
        <TaskError
          error={query.error}
          retry={() => void query.refetch()}
          fetching={query.isFetching}
        />
      ) : data && summary ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-stone-700">
              Đọc lúc: {taskDate(new Date(data.readAt).toISOString())}
            </p>
            <Button
              variant="secondary"
              disabled={query.isFetching}
              onClick={() => void query.refetch()}
            >
              Làm mới
            </Button>
          </div>
          {query.isFetching && <p role="status">Đang làm mới bảng điều khiển…</p>}
          <dl
            aria-label="Thống kê công việc của bạn"
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5"
          >
            {metrics.map(([label, value]) => (
              <div
                key={label}
                className="min-w-0 rounded-lg border border-stone-300 bg-surface p-6"
              >
                <dt className="text-sm font-medium text-stone-700">{label}</dt>
                <dd className="mt-2 text-3xl font-semibold text-pearl-900">
                  {value.toLocaleString('vi-VN')}
                </dd>
              </div>
            ))}
          </dl>
          <p className="text-sm text-stone-700">
            Tổng từng trạng thái do máy chủ trả về, chỉ gồm công việc của bạn; hoàn thành tính mọi
            thời điểm. Sắp đến hạn: công việc đã giao hoặc đang thực hiện, có hạn từ lúc đọc đến 24
            giờ sau (gồm hai mốc). Quá hạn: hạn trước lúc đọc; không gồm công việc hoàn thành hoặc
            chưa có hạn.
          </p>
          <section aria-labelledby="priority-title" className="space-y-4">
            <h2 id="priority-title" className="text-xl font-semibold">
              {operations ? 'Công việc vận hành cần chú ý' : 'Công việc dịch vụ cần chú ý'}
            </h2>
            <p className="text-sm text-stone-700">
              Tối đa 5 công việc từ toàn bộ công việc đang hoạt động: hạn sớm trước, chưa có hạn
              sau; cùng hạn xếp theo chuỗi ưu tiên đã biết, rồi chuỗi khác và mã công việc.
            </p>
            {summary.priority.length === 0 ? (
              <p>Bạn chưa có công việc đang hoạt động.</p>
            ) : (
              <ol className="space-y-3">
                {summary.priority.map((task) => (
                  <li
                    key={task.id}
                    className="min-w-0 space-y-3 rounded-lg border border-stone-300 bg-surface p-4 sm:p-6"
                  >
                    <Link
                      className={`${linkClass} max-w-full break-words font-semibold`}
                      to={`/staff/tasks/${encodeURIComponent(task.id)}`}
                    >
                      {task.title}
                    </Link>
                    <div className="flex flex-wrap gap-2">
                      <TaskStatusBadge status={task.status} />
                      <TaskPriorityBadge priority={task.priority} />
                    </div>
                    <p className="break-words text-sm text-stone-700">
                      Hạn: {taskDate(task.dueAt)}
                      {task.dueAt && Date.parse(task.dueAt) < data.readAt ? ' · Quá hạn' : ''}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </section>
          <p className="text-sm text-stone-700">
            Dữ liệu được đọc qua nhiều yêu cầu, không phải ảnh chụp đồng thời. Nếu phát hiện tổng
            thay đổi, trùng hoặc thiếu trang, bảng tổng hợp sẽ báo lỗi thay vì hiển thị một phần.
            Hãy làm mới sau khi cập nhật công việc.
          </p>
        </>
      ) : null}
    </section>
  )
}

export function ServiceStaffDashboardPage() {
  return <StaffDashboardPage operations={false} />
}

export function OperationsStaffDashboardPage() {
  return <StaffDashboardPage operations />
}
