import { Badge, Button } from '@/components/atoms'
import { Alert } from '@/components/molecules'
import { getErrorMessage } from '@/lib/api-client'
import { priorityLabel, QUEUE_LABELS } from '../presentation'
import type { QueueStatus } from '../api'

export function QueuePriority({ priority }: { priority?: string | null }) {
  return (
    <Badge tone={priority === 'HIGH' || priority === 'URGENT' ? 'danger' : 'neutral'}>
      <span>{priorityLabel(priority)}</span>
    </Badge>
  )
}
export function QueueStatusBadge({ status }: { status: string }) {
  return (
    <Badge
      tone={status === 'COMPLETED' ? 'success' : status === 'IN_PROGRESS' ? 'warning' : 'info'}
    >
      <span>{QUEUE_LABELS[status as QueueStatus] ?? status}</span>
    </Badge>
  )
}
export function QueueError({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <div className="space-y-3">
      <Alert tone="danger">{getErrorMessage(error)}</Alert>
      <Button variant="outline" onClick={retry}>
        Thử lại
      </Button>
    </div>
  )
}
