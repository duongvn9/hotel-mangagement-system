import { api } from '@/lib/api-client'

export type TaskStatus = 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED'

export interface AssignedTask {
  id: string
  title: string
  taskType: string
  priority: string
  status: TaskStatus
  assignedAt: string
  dueAt?: string
  completedAt?: string
  workResult?: string
  sourceType: 'SERVICE_ORDER' | 'ISSUE' | 'MAINTENANCE'
  sourceId: string
  sourceSummary: null
}

export interface TaskQuery {
  status?: TaskStatus
  taskType?: string
  keyword?: string
  page: number
  limit: number
}

export interface TaskList {
  items: AssignedTask[]
  total: number
  page: number
  limit: number
}

export async function listAssignedTasks(query: TaskQuery): Promise<TaskList> {
  return (await api.get<TaskList>('/tasks/me', { params: query })).data
}

export async function getAssignedTask(id: string): Promise<AssignedTask> {
  return (await api.get<AssignedTask>(`/tasks/${encodeURIComponent(id)}`)).data
}
