import { isAxiosError } from 'axios'
import { Link } from 'react-router'
import { Badge, Button, Skeleton } from '@/components/atoms'
import { Alert, StatCard } from '@/components/molecules'
import { PageContainer, PageHeader, Panel } from '@/components/organisms'
import { useAuth } from '@/features/auth/auth-context'
import { taskDate, taskStatuses } from '@/features/tasks/presentation'
import { getErrorMessage } from '@/lib/api-client'
import { DashboardReadError, summarizeDashboard } from './api'
import { useStaffDashboard } from './hooks'

const priorityLabels: Record<string, string> = {
  LOW: 'Thấp',
  NORMAL: 'Bình thường',
  MEDIUM: 'Trung bình',
  HIGH: 'Cao',
  URGENT: 'Khẩn cấp',
}

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

  const errorStatus = isAxiosError(query.error) ? query.error.response?.status : undefined
  const denied = errorStatus === 403 || errorStatus === 404
  const errorMessage =
    query.error instanceof DashboardReadError
      ? query.error.message
      : errorStatus === 403
        ? 'Bạn không có quyền xem công việc này.'
        : errorStatus === 404
          ? 'Không tìm thấy công việc hoặc công việc không được giao cho bạn.'
          : getErrorMessage(query.error)

  return (
    <PageContainer>
      <section aria-label={operations ? 'Bảng điều khiển vận hành' : 'Bảng điều khiển dịch vụ'}>
        <PageHeader
          eyebrow={operations ? 'Vận hành' : 'Đội dịch vụ'}
          title={operations ? 'Bảng điều khiển vận hành' : 'Bảng điều khiển dịch vụ'}
          subtitle={`Xin chào ${me?.fullName}. ${
            operations
              ? 'Theo dõi công việc vận hành, bảo trì và xử lý sự cố được giao cho bạn.'
              : 'Theo dõi công việc phục vụ và xử lý sự cố được giao cho bạn.'
          }`}
        />
        <div className="space-y-6">
          <nav aria-label="Thao tác nhân viên" className="flex flex-wrap gap-x-6 gap-y-2">
            <Link className={linkClass} to="/staff/tasks">
              Xem công việc được giao
            </Link>
            {!operations && me?.role === 'SERVICE_STAFF' && (
              <Link className={linkClass} to="/staff/service-history">
                Lịch sử thực hiện dịch vụ
              </Link>
            )}
            <Link className={linkClass} to="/profile">
              Cập nhật hồ sơ
            </Link>
          </nav>
          {query.isPending ? (
            <div role="status" className="space-y-4 text-sm text-muted-foreground">
              <p>Đang tải bảng điều khiển…</p>
              <div
                aria-hidden="true"
                className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5"
              >
                {Array.from({ length: 5 }, (_, index) => (
                  <Skeleton key={index} className="h-28 rounded-xl" />
                ))}
              </div>
            </div>
          ) : query.isError ? (
            <div className="space-y-3">
              <Alert tone="danger">{errorMessage}</Alert>
              <Button
                variant="secondary"
                disabled={denied || query.isFetching}
                onClick={() => void query.refetch()}
              >
                Thử lại
              </Button>
            </div>
          ) : data && summary ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
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
                  <div key={label} className="min-w-0">
                    <dt className="sr-only" aria-label={label} />
                    <StatCard label={label} value={<dd>{value.toLocaleString('vi-VN')}</dd>} />
                  </div>
                ))}
              </dl>
              <p className="text-sm text-muted-foreground">
                Tổng từng trạng thái do máy chủ trả về, chỉ gồm công việc của bạn; hoàn thành tính
                mọi thời điểm. Sắp đến hạn: công việc đã giao hoặc đang thực hiện, có hạn từ lúc đọc
                đến 24 giờ sau (gồm hai mốc). Quá hạn: hạn trước lúc đọc; không gồm công việc hoàn
                thành hoặc chưa có hạn.
              </p>
              <Panel
                title={operations ? 'Công việc vận hành cần chú ý' : 'Công việc dịch vụ cần chú ý'}
              >
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Tối đa 5 công việc từ toàn bộ công việc đang hoạt động: hạn sớm trước, chưa có
                    hạn sau; cùng hạn xếp theo chuỗi ưu tiên đã biết, rồi chuỗi khác và mã công
                    việc.
                  </p>
                  {summary.priority.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Bạn chưa có công việc đang hoạt động.
                    </p>
                  ) : (
                    <ol className="divide-y divide-border">
                      {summary.priority.map((task) => (
                        <li key={task.id} className="min-w-0 space-y-3 py-3 text-sm">
                          <Link
                            className={`${linkClass} max-w-full break-words font-semibold`}
                            to={`/staff/tasks/${encodeURIComponent(task.id)}`}
                          >
                            {task.title}
                          </Link>
                          <div className="flex flex-wrap gap-2">
                            <Badge
                              tone={
                                task.status === 'COMPLETED'
                                  ? 'success'
                                  : task.status === 'IN_PROGRESS'
                                    ? 'warning'
                                    : 'info'
                              }
                            >
                              {taskStatuses[task.status]}
                            </Badge>
                            <Badge
                              tone={
                                ['HIGH', 'URGENT'].includes(task.priority) ? 'danger' : 'neutral'
                              }
                            >
                              Ưu tiên: {priorityLabels[task.priority] ?? task.priority}
                            </Badge>
                          </div>
                          <p className="break-words text-sm text-muted-foreground">
                            Hạn: {taskDate(task.dueAt)}
                            {task.dueAt && Date.parse(task.dueAt) < data.readAt ? ' · Quá hạn' : ''}
                          </p>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              </Panel>
              <p className="text-sm text-muted-foreground">
                Dữ liệu được đọc qua nhiều yêu cầu, không phải ảnh chụp đồng thời. Nếu phát hiện
                tổng thay đổi, trùng hoặc thiếu trang, bảng tổng hợp sẽ báo lỗi thay vì hiển thị một
                phần. Hãy làm mới sau khi cập nhật công việc.
              </p>
            </>
          ) : null}
        </div>
      </section>
    </PageContainer>
  )
}

export function ServiceStaffDashboardPage() {
  return <StaffDashboardPage operations={false} />
}

export function OperationsStaffDashboardPage() {
  return <StaffDashboardPage operations />
}
