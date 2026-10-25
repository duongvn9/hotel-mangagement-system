import { api } from '@/lib/api-client'
import type { TaskStatus, AssignedTask } from '@/features/tasks/api'

export type QueueStatus = TaskStatus
export type QueueSource = AssignedTask['sourceType']
export interface QueueFilters {
  taskType?: string
  sourceType?: QueueSource
  priority?: string
  assigneeId?: string
  q?: string
}
export interface QueueQuery extends QueueFilters {
  status?: QueueStatus
  overdue?: boolean
  page: number
  limit: number
  sortBy: 'assignedAt' | 'dueAt' | 'completedAt'
  sortOrder: 'asc' | 'desc'
}
export interface QueuePerson {
  id: string
  fullName: string
  role: string
}
export interface QueueWorkload {
  assignee: QueuePerson | null
  assigned: number
  inProgress: number
  completed: number
  overdue: number
}
export interface QueueSummary {
  counts: { assigned: number; inProgress: number; completed: number; other: number; total: number }
  overdue: number
  workload: QueueWorkload[]
  facets: { taskTypes: string[]; priorities: string[] }
  generatedAt: string
}
export interface QueueTask {
  id: string
  title: string
  taskType: string
  priority?: string | null
  status: string
  sourceType: QueueSource
  sourceId: string
  assignee: QueuePerson | null
  assignedAt: string | null
  dueAt: string | null
  completedAt: string | null
  overdue: boolean
}
export interface QueuePage {
  items: QueueTask[]
  total: number
  page: number
  limit: number
}
export interface QueueDetail extends QueueTask {
  workResult?: string | null
  createdAt?: string
  updatedAt?: string
  source: { sourceType: QueueSource; sourceId: string }
  sourceSummary: {
    description: string
    room: { roomNumber: string } | null
    equipment: { assetCode: string; name: string } | null
    preventsSafeUse: boolean
  } | null
}
export async function getQueueSummary(filters: QueueFilters): Promise<QueueSummary> {
  return (await api.get<QueueSummary>('/task-queues/summary', { params: filters })).data
}
export async function listQueueTasks(query: QueueQuery): Promise<QueuePage> {
  return (await api.get<QueuePage>('/task-queues/tasks', { params: query })).data
}
export async function getQueueTask(id: string): Promise<QueueDetail> {
  return (await api.get<QueueDetail>(`/task-queues/tasks/${encodeURIComponent(id)}`)).data
}
