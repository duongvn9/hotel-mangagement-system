import { isAxiosError } from 'axios'
import { Link, useLocation, useParams } from 'react-router'
import { Badge, Button } from '@/components/atoms'
import { Alert } from '@/components/molecules'
import { PageContainer, PageHeader, Panel } from '@/components/organisms'
import { ROLE_LABELS } from '@/features/auth/api'
import { ResolutionHistory } from '@/features/tasks/TaskResolution'
import { useQueueTask } from '../hooks'
import { queueDate, SOURCE_LABELS } from '../presentation'
import { QueueError, QueuePriority, QueueStatusBadge } from '../components/QueuePresentation'

export function TaskQueueDetailPage() {
  const { taskId = '' } = useParams()
  const location = useLocation()
  const query = useQueueTask(taskId)
  const task = query.data
  const missing = isAxiosError(query.error) && query.error.response?.status === 404
  return (
    <PageContainer className="max-w-3xl">
      <PageHeader title="Thông tin task hiện tại" />
      <div className="space-y-6">
        <Button asChild variant="outline" className="rounded-full">
          <Link to={`/manager/task-queues${location.search}`}>Quay lại hàng đợi</Link>
        </Button>
        {query.isPending && <p role="status">Đang tải thông tin task…</p>}
        {query.isError &&
          (missing ? (
            <Alert tone="danger">Không tìm thấy task</Alert>
          ) : (
            <QueueError error={query.error} retry={() => void query.refetch()} />
          ))}
        {task && (
          <>
            <Panel>
              <div className="space-y-4 text-sm">
                <h2 className="text-xl font-semibold break-words">{task.title}</h2>
                <div className="flex flex-wrap gap-3">
                  <QueueStatusBadge status={task.status} />
                  <QueuePriority priority={task.priority} />
                  {task.overdue && (
                    <Badge tone="danger">
                      <span>Quá hạn</span>
                    </Badge>
                  )}
                </div>
                <dl className="grid min-w-0 grid-cols-1 gap-3 break-words sm:grid-cols-[auto_minmax(0,1fr)]">
                  <dt className="font-semibold">Loại task</dt>
                  <dd>{task.taskType}</dd>
                  <dt className="font-semibold">Người thực hiện</dt>
                  <dd>
                    {task.assignee
                      ? `${task.assignee.fullName} · ${ROLE_LABELS[task.assignee.role] ?? task.assignee.role}`
                      : 'Không còn nhân viên'}
                  </dd>
                  <dt className="font-semibold">Giao lúc</dt>
                  <dd>{queueDate(task.assignedAt)}</dd>
                  <dt className="font-semibold">Hạn hoàn thành</dt>
                  <dd>{queueDate(task.dueAt)}</dd>
                  {task.status === 'COMPLETED' && (
                    <>
                      <dt className="font-semibold">Hoàn thành lúc</dt>
                      <dd>{queueDate(task.completedAt)}</dd>
                      <dt className="font-semibold">Kết quả công việc</dt>
                      <dd className="whitespace-pre-wrap">
                        {task.workResult || 'Chưa có kết quả'}
                      </dd>
                    </>
                  )}
                  <dt className="font-semibold">Nguồn task</dt>
                  <dd>
                    {SOURCE_LABELS[task.sourceType] ?? task.sourceType} · {task.sourceId}
                  </dd>
                </dl>
                <ResolutionHistory task={task} />
                <p className="text-muted-foreground">
                  Chức năng giám sát chỉ xem, không thay đổi task.
                </p>
              </div>
            </Panel>
            {task.sourceType === 'MAINTENANCE' && task.sourceSummary && (
              <Panel title="Nguồn bảo trì">
                <div className="space-y-3 break-words text-sm">
                  <p className="break-words whitespace-pre-wrap">
                    {task.sourceSummary.description}
                  </p>
                  {task.sourceSummary.room && <p>Phòng {task.sourceSummary.room.roomNumber}</p>}
                  {task.sourceSummary.equipment && (
                    <p>
                      {task.sourceSummary.equipment.assetCode} — {task.sourceSummary.equipment.name}
                    </p>
                  )}
                  <p>
                    Ngăn dùng phòng an toàn: {task.sourceSummary.preventsSafeUse ? 'Có' : 'Không'}
                  </p>
                </div>
              </Panel>
            )}
          </>
        )}
      </div>
    </PageContainer>
  )
}
