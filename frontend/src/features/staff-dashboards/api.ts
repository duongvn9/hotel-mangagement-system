import { api } from '@/lib/api-client'
import type { AssignedTask, TaskList, TaskStatus } from '@/features/tasks/api'

const PAGE_SIZE = 100
const MAX_PAGES = 100
const statuses: TaskStatus[] = ['ASSIGNED', 'IN_PROGRESS', 'COMPLETED']

export class DashboardReadError extends Error {}

export interface StaffDashboardData {
  counts: Record<TaskStatus, number>
  active: AssignedTask[]
  readAt: number
}

async function readPage(status: TaskStatus, page: number, limit: number, signal: AbortSignal) {
  const { data } = await api.get<TaskList>('/tasks/me', {
    params: { status, page, limit },
    signal,
  })
  if (
    !Number.isSafeInteger(data.total) ||
    data.total < 0 ||
    data.page !== page ||
    data.limit !== limit ||
    !Array.isArray(data.items)
  )
    throw new DashboardReadError('Phản hồi công việc không hợp lệ. Vui lòng tải lại.')
  return data
}

export async function readStaffDashboard(signal: AbortSignal): Promise<StaffDashboardData> {
  const totals = await Promise.all(statuses.map((status) => readPage(status, 1, 1, signal)))
  const counts = Object.fromEntries(
    statuses.map((status, index) => [status, totals[index]!.total]),
  ) as Record<TaskStatus, number>
  const active: AssignedTask[] = []
  const ids = new Set<string>()
  for (const status of ['ASSIGNED', 'IN_PROGRESS'] as const) {
    const total = counts[status]
    const pages = Math.ceil(total / PAGE_SIZE)
    if (pages > MAX_PAGES)
      throw new DashboardReadError(
        'Vượt giới hạn đọc 10.000 công việc mỗi trạng thái. Không hiển thị tổng hợp một phần; hãy xem công việc được giao.',
      )
    for (let page = 1; page <= pages; page++) {
      signal.throwIfAborted()
      const result = await readPage(status, page, PAGE_SIZE, signal)
      const expected = Math.min(PAGE_SIZE, total - (page - 1) * PAGE_SIZE)
      if (
        result.total !== total ||
        result.items.length !== expected ||
        result.items.some((task) => task.status !== status || ids.has(task.id))
      ) {
        throw new DashboardReadError(
          'Công việc đã thay đổi trong lúc đọc hoặc dữ liệu chưa đầy đủ. Vui lòng tải lại.',
        )
      }
      for (const task of result.items) {
        if (ids.has(task.id))
          throw new DashboardReadError('Công việc bị trùng trong lúc đọc. Vui lòng tải lại.')
        ids.add(task.id)
        active.push(task)
      }
    }
  }
  return { counts, active, readAt: Date.now() }
}

const priorityRank: Record<string, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, NORMAL: 2, LOW: 3 }
const dueTime = (task: AssignedTask) => {
  const value = task.dueAt ? Date.parse(task.dueAt) : NaN
  return Number.isFinite(value) ? value : Infinity
}

export function summarizeDashboard(data: StaffDashboardData) {
  const end = data.readAt + 24 * 60 * 60 * 1000
  return {
    overdue: data.active.filter((task) => dueTime(task) < data.readAt).length,
    nearDue: data.active.filter((task) => dueTime(task) >= data.readAt && dueTime(task) <= end)
      .length,
    priority: [...data.active]
      .sort((a, b) => {
        const aDue = dueTime(a)
        const bDue = dueTime(b)
        if (aDue !== bDue) return aDue < bDue ? -1 : 1
        const rank = (priorityRank[a.priority] ?? 4) - (priorityRank[b.priority] ?? 4)
        if (rank) return rank
        if (a.priority !== b.priority) return a.priority < b.priority ? -1 : 1
        return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
      })
      .slice(0, 5),
  }
}
