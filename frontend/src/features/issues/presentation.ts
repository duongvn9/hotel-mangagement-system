import type { CustomerHistoryType, IssueDetail } from './api'
import { resolutionEvents, type ResolutionEvent } from '@/features/tasks/presentation'

export function issueResolutionEvents(issue: IssueDetail): ResolutionEvent[] {
  const tasks = [
    ...new Map(
      [...issue.linkedTasks, ...(issue.resolutionTasks ?? [])].map((task) => [task.id, task]),
    ).values(),
  ]
  const events: ResolutionEvent[] = []
  for (const task of tasks) {
    events.push({
      id: `assigned:${task.id}`,
      at: task.assignedAt,
      label: 'Đã giao công việc',
      details: [
        `Công việc: ${task.title}`,
        ...(task.assigneeName ? [`Nhân viên: ${personName(task.assigneeName)}`] : []),
        ...(task.dueAt ? [`Thời hạn: ${issueDate(task.dueAt)}`] : []),
        ...(task.instructions ? [`Hướng dẫn: ${task.instructions}`] : []),
      ],
    })
    const workResult =
      'workResult' in task && typeof task.workResult === 'string' ? task.workResult : undefined
    events.push(
      ...resolutionEvents(task).map((event) => ({
        ...event,
        id: `${task.id}:${event.id}`,
        details: [
          ...event.details,
          ...(event.id.startsWith('cancel:') && workResult ? [`Kết quả: ${workResult}`] : []),
        ],
      })),
    )
    if (task.completedAt)
      events.push({
        id: `completed:${task.id}`,
        at: task.completedAt,
        label: 'Đã hoàn thành công việc',
        details: [
          `Công việc: ${task.title}`,
          ...(task.assigneeName ? [`Nhân viên: ${personName(task.assigneeName)}`] : []),
          ...(workResult ? [`Kết quả: ${workResult}`] : []),
        ],
      })
  }
  for (const entry of issue.reassignmentHistory ?? []) {
    events.push({
      id: `reassigned:${entry.requestId}`,
      at: entry.completedAt,
      label: 'Đã phân công lại',
      details: [
        entry.actorName && `Người yêu cầu: ${personName(entry.actorName)}`,
        entry.assigneeName && `Nhân viên thay thế: ${personName(entry.assigneeName)}`,
        `Lý do: ${entry.reason}`,
        ...(entry.recoveryActorNames ?? [])
          .filter(Boolean)
          .map((name) => `Người khôi phục: ${personName(name)}`),
      ].filter((value): value is string => Boolean(value)),
    })
  }
  const pending = issue.pendingReassignment
  if (pending)
    events.push({
      id: `pending:${pending.requestId}:${pending.targetTaskId}`,
      at: pending.requestedAt,
      label: 'Phân công lại đang chờ khôi phục',
      details: [
        `Lý do: ${pending.reason}`,
        ...(pending.assigneeName ? [`Nhân viên đích: ${personName(pending.assigneeName)}`] : []),
      ],
    })
  if (issue.closedAt)
    events.push({
      id: `closed:${issue.id}`,
      at: issue.closedAt,
      label: 'Đã đóng sự cố',
      details: issue.closedByName ? [`Người đóng: ${personName(issue.closedByName)}`] : [],
    })
  return [...new Map(events.map((event) => [event.id, event])).values()]
    .filter((event) => Boolean(event.at) && Number.isFinite(new Date(event.at).getTime()))
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
}

export const customerHistoryLabels: Record<CustomerHistoryType, string> = {
  REPORTED: 'Đã báo sự cố',
  REVIEWED: 'Đã xem xét',
  ASSIGNED: 'Đã phân công',
  CONTINUED: 'Tiếp tục xử lý',
  REASSIGNED: 'Đã phân công lại',
  TASK_COMPLETED: 'Đã hoàn thành công việc',
  CLOSED: 'Đã đóng sự cố',
}

export const statusLabels = {
  PENDING_REVIEW: 'Chờ xem xét',
  REVIEWED: 'Đã xem xét',
  CONCLUDED: 'Đã kết luận',
  ASSIGNING: 'Đang phân công',
  ASSIGNED: 'Đã phân công',
  CLOSED: 'Đã đóng',
} as const

export const priorityLabels = {
  LOW: 'Thấp',
  NORMAL: 'Bình thường',
  HIGH: 'Cao',
  URGENT: 'Khẩn cấp',
} as const

export const handlingLabels = { SERVICE: 'Dịch vụ', OPERATIONS: 'Vận hành' } as const
export const staffRoleLabels: Record<string, string> = {
  SERVICE_STAFF: 'Nhân viên dịch vụ',
  OPERATIONS_STAFF: 'Nhân viên vận hành',
}

export const issueViews = {
  CUSTOMER: { path: '/customer/issues', title: 'Sự cố của tôi' },
  RECEPTIONIST: { path: '/staff/issues', title: 'Yêu cầu sự cố' },
  MANAGER: { path: '/manager/issues', title: 'Danh sách sự cố' },
} as const

export type IssueRole = keyof typeof issueViews

export function displayText(value: string | null | undefined, fallback: string) {
  const text = value?.trim()
  return text && !/[a-f\d]{24}/i.test(text) ? text : fallback
}

export function personName(value?: string | null) {
  return displayText(value, 'Chưa có thông tin người dùng')
}

export function bookingCode(value?: string | null) {
  return displayText(value, 'Chưa có thông tin đặt phòng')
}

export function taskStatusLabel(value: string) {
  const labels: Record<string, string> = {
    ASSIGNED: 'Đã phân công',
    IN_PROGRESS: 'Đang xử lý',
    COMPLETED: 'Đã hoàn thành',
    CANCELLED: 'Đã hủy',
  }
  return labels[value] ?? 'Chưa có thông tin trạng thái'
}

export function taskTypeLabel(value: string) {
  const labels: Record<string, string> = {
    ISSUE_RESOLUTION: 'Xử lý sự cố',
    SERVICE_EXECUTION: 'Thực hiện dịch vụ',
    MAINTENANCE: 'Bảo trì',
    CHECKOUT_INSPECTION: 'Kiểm tra trả phòng',
  }
  return labels[value] ?? 'Công việc liên quan'
}

export function taskPriorityLabel(value: string) {
  return priorityLabels[value as keyof typeof priorityLabels] ?? 'Chưa có thông tin ưu tiên'
}

export function issueRoomLabel(issue: {
  roomId?: string
  roomNumber?: string | null
  roomNumbers?: string[]
}) {
  if (issue.roomId) {
    return issue.roomNumber?.trim()
      ? displayText(`Phòng ${issue.roomNumber.trim()}`, 'Không có thông tin phòng')
      : 'Không có thông tin phòng'
  }
  const numbers = issue.roomNumbers?.filter((number) => displayText(number, '') !== '')
  return numbers?.length ? `Phòng ${numbers.join(', ')}` : 'Không gắn với phòng'
}

export function issueDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Không có thời gian hợp lệ' : date.toLocaleString('vi-VN')
}
