import { Badge } from '@/components/Badge'
import { Alert } from '@/components/Alert'
import { Button } from '@/components/Button'
import { getErrorMessage } from '@/lib/api-client'
import { priorityLabel, QUEUE_LABELS } from '../presentation'
import type { QueueStatus } from '../api'

export function QueuePriority({ priority }: { priority?: string | null }) {
  return (
    <Badge tone={priority === 'HIGH' || priority === 'URGENT' ? 'danger' : 'neutral'}>
      {priorityLabel(priority)}
    </Badge>
  )
}
export function QueueStatusBadge({ status }: { status: string }) {
  return (
    <Badge
      tone={status === 'COMPLETED' ? 'success' : status === 'IN_PROGRESS' ? 'warning' : 'info'}
    >
      {QUEUE_LABELS[status as QueueStatus] ?? status}
    </Badge>
  )
}
export function QueueError({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <div className="space-y-3">
      <Alert tone="danger">{getErrorMessage(error)}</Alert>
      <Button variant="secondary" onClick={retry}>
        Thử lại
      </Button>
    </div>
  )
}
