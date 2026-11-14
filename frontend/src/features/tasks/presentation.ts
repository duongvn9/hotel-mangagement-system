import type { TaskResolution, TaskStatus } from './api'

export const taskStatuses: Record<TaskStatus, string> = {
  ASSIGNED: 'Đã giao',
  IN_PROGRESS: 'Đang thực hiện',
  COMPLETED: 'Hoàn thành',
  CANCELLED: 'Đã hủy',
}

export const taskTypes: Record<string, string> = {
  SERVICE_ORDER_EXECUTION: 'Thực hiện yêu cầu dịch vụ',
  ISSUE_RESOLUTION: 'Xử lý sự cố',
  ROOM_CHECK: 'Kiểm tra phòng',
  MAINTENANCE: 'Bảo trì',
  CHECKOUT_INSPECTION: 'Kiểm tra trả phòng',
}

export function taskTypeLabel(type: string) {
  return taskTypes[type] ?? 'Công việc khác'
}

export const taskSources = {
  SERVICE_ORDER: 'Yêu cầu dịch vụ',
  ISSUE: 'Sự cố',
  MAINTENANCE: 'Bảo trì',
  CHECKOUT_INSPECTION: 'Kiểm tra trả phòng',
}

export function taskDate(value?: string) {
  return value ? new Date(value).toLocaleString('vi-VN') : 'Chưa có'
}

type NamedResolution = TaskResolution & {
  blockerHistory?: (NonNullable<TaskResolution['blockerHistory']>[number] & {
    reportedByName?: string | null
    resolvedByName?: string | null
  })[]
  continuationHistory?: (NonNullable<TaskResolution['continuationHistory']>[number] & {
    actorName?: string | null
  })[]
  cancellation?: NonNullable<TaskResolution['cancellation']> & {
    actorName?: string | null
    recoveryActorName?: string | null
  }
}

export interface ResolutionEvent {
  id: string
  at: string
  label: string
  details: string[]
}

export function resolutionEvents(task: NamedResolution): ResolutionEvent[] {
  const events: ResolutionEvent[] = []
  for (const report of task.blockerHistory ?? []) {
    events.push({
      id: `blocker:${report.id}`,
      at: report.reportedAt,
      label: `Lý do không thể xử lý: ${report.reason}`,
      details: report.reportedByName ? [`Người báo không thể xử lý: ${report.reportedByName}`] : [],
    })
    if (report.resolvedAt)
      events.push({
        id: `resolved:${report.id}`,
        at: report.resolvedAt,
        label:
          report.resolution === 'CONTINUED'
            ? 'Đã tiếp tục xử lý'
            : report.resolution === 'REASSIGNED'
              ? 'Đã phân công lại'
              : 'Đã xem xét báo cáo',
        details: report.resolvedByName ? [`Người xem xét: ${report.resolvedByName}`] : [],
      })
  }
  for (const entry of task.continuationHistory ?? []) {
    events.push({
      id: `continue:${JSON.stringify([entry.actorId, entry.at, entry.dueAt, entry.instructions])}`,
      at: entry.at,
      label: 'Tiếp tục:',
      details: [
        entry.actorName && `Người tiếp tục xử lý: ${entry.actorName}`,
        entry.dueAt && `Hạn: ${taskDate(entry.dueAt)}`,
        entry.instructions,
      ].filter((value): value is string => Boolean(value)),
    })
  }
  const cancellation = task.cancellation
  if (cancellation)
    events.push({
      id: `cancel:${cancellation.requestId}`,
      at: cancellation.at,
      label: `Đã hủy do phân công lại: ${cancellation.reason}`,
      details: [
        cancellation.actorName && `Người yêu cầu phân công lại: ${cancellation.actorName}`,
        cancellation.recoveryActorName && `Người khôi phục: ${cancellation.recoveryActorName}`,
      ].filter((value): value is string => Boolean(value)),
    })
  return [...new Map(events.map((event) => [event.id, event])).values()]
    .filter((event) => Boolean(event.at) && Number.isFinite(new Date(event.at).getTime()))
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
}
