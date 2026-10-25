import { isAxiosError } from 'axios'
import { Link, useLocation, useParams } from 'react-router'
import { Alert } from '@/components/Alert'
import { Badge } from '@/components/Badge'
import { ROLE_LABELS } from '@/features/auth/api'
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
    <section className="mx-auto max-w-3xl space-y-6 px-4 py-10 font-body">
      <h1 className="font-display text-4xl font-semibold">Thông tin task hiện tại</h1>
      <Link
        className="inline-flex min-h-11 items-center text-primary underline"
        to={`/manager/task-queues${location.search}`}
      >
        Quay lại hàng đợi
      </Link>
      {query.isPending && <p role="status">Đang tải thông tin task…</p>}
      {query.isError &&
        (missing ? (
          <Alert tone="danger">Không tìm thấy task</Alert>
        ) : (
          <QueueError error={query.error} retry={() => void query.refetch()} />
        ))}
      {task && (
        <>
          <div className="space-y-4 rounded border border-stone-300 bg-white p-5 text-sm">
            <h2 className="text-xl font-semibold break-words">{task.title}</h2>
            <div className="flex flex-wrap gap-3">
              <QueueStatusBadge status={task.status} />
              <QueuePriority priority={task.priority} />
              {task.overdue && <Badge tone="danger">Quá hạn</Badge>}
            </div>
            <dl className="grid gap-3 break-words sm:grid-cols-[auto_1fr]">
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
                  <dd className="whitespace-pre-wrap">{task.workResult || 'Chưa có kết quả'}</dd>
                </>
              )}
              <dt className="font-semibold">Nguồn task</dt>
              <dd>
                {SOURCE_LABELS[task.sourceType] ?? task.sourceType} · {task.sourceId}
              </dd>
            </dl>
            <p className="text-stone-700">Chức năng giám sát chỉ xem, không thay đổi task.</p>
          </div>
          {task.sourceType === 'MAINTENANCE' && task.sourceSummary && (
            <div className="space-y-3 rounded border border-stone-300 bg-white p-5 text-sm">
              <h2 className="text-xl font-semibold">Nguồn bảo trì</h2>
              <p className="break-words whitespace-pre-wrap">{task.sourceSummary.description}</p>
              {task.sourceSummary.room && <p>Phòng {task.sourceSummary.room.roomNumber}</p>}
              {task.sourceSummary.equipment && (
                <p>
                  {task.sourceSummary.equipment.assetCode} — {task.sourceSummary.equipment.name}
                </p>
              )}
              <p>Ngăn dùng phòng an toàn: {task.sourceSummary.preventsSafeUse ? 'Có' : 'Không'}</p>
            </div>
          )}
        </>
      )}
    </section>
  )
}
