import { isAxiosError } from 'axios'
import { Alert } from '@/components/Alert'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { getErrorMessage } from '@/lib/api-client'
import type { TaskStatus } from './api'

import { taskStatuses } from './presentation'

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return (
    <Badge
      tone={status === 'COMPLETED' ? 'success' : status === 'IN_PROGRESS' ? 'warning' : 'info'}
    >
      {taskStatuses[status]}
    </Badge>
  )
}

export function TaskPriorityBadge({ priority }: { priority: string }) {
  const labels: Record<string, string> = {
    LOW: 'Thấp',
    NORMAL: 'Bình thường',
    MEDIUM: 'Trung bình',
    HIGH: 'Cao',
    URGENT: 'Khẩn cấp',
  }
  return (
    <Badge tone={['HIGH', 'URGENT'].includes(priority) ? 'danger' : 'neutral'}>
      Ưu tiên: {labels[priority] ?? priority}
    </Badge>
  )
}

export function TaskError({
  error,
  retry,
  fetching,
}: {
  error: unknown
  retry: () => void
  fetching: boolean
}) {
  const status = isAxiosError(error) ? error.response?.status : undefined
  const denied = status === 403 || status === 404
  const message =
    status === 403
      ? 'Bạn không có quyền xem công việc này.'
      : status === 404
        ? 'Không tìm thấy công việc hoặc công việc không được giao cho bạn.'
        : getErrorMessage(error)
  return (
    <div className="space-y-3">
      <Alert tone="danger">{message}</Alert>
      <Button variant="secondary" disabled={denied || fetching} onClick={retry}>
        Thử lại
      </Button>
    </div>
  )
}
