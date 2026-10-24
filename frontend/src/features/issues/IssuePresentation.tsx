import { isAxiosError } from 'axios'
import { Badge } from '@/components/Badge'

import type { IssueRead } from './api'
import { priorityLabels, statusLabels } from './presentation'

export function IssueBadges({ issue }: { issue: IssueRead }) {
  return (
    <span className="inline-flex flex-wrap gap-2">
      <Badge
        tone={
          issue.status === 'PENDING_REVIEW' || issue.status === 'ASSIGNING' ? 'warning' : 'neutral'
        }
      >
        {statusLabels[issue.status]}
      </Badge>
      <Badge tone="neutral">Ưu tiên: {priorityLabels[issue.priority]}</Badge>
    </span>
  )
}

export function IssueError({ error, retry }: { error: unknown; retry: () => void }) {
  const status = isAxiosError(error) ? error.response?.status : undefined
  return (
    <div role="alert" className="rounded-lg border border-danger bg-danger-bg p-6 text-danger">
      <p>
        {status === 403
          ? 'Bạn không có quyền xem sự cố này.'
          : status === 404
            ? 'Không tìm thấy sự cố trong phạm vi truy cập của bạn.'
            : 'Không thể tải thông tin sự cố. Vui lòng thử lại.'}
      </p>
      {status !== 403 && status !== 404 && (
        <button type="button" onClick={retry} className="mt-4 min-h-11 underline">
          Thử lại
        </button>
      )}
    </div>
  )
}
