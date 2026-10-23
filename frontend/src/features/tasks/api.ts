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

export type TaskProgressInput =
  { status: 'IN_PROGRESS' } | { status: 'COMPLETED'; workResult: string }

export async function updateTaskProgress(
  id: string,
  input: TaskProgressInput,
): Promise<AssignedTask> {
  const body =
    input.status === 'IN_PROGRESS'
      ? { status: input.status }
      : { status: input.status, workResult: input.workResult.trim() }
  return (await api.patch<AssignedTask>(`/tasks/${encodeURIComponent(id)}/progress`, body)).data
}

export async function getAssignedTask(id: string): Promise<AssignedTask> {
  return (await api.get<AssignedTask>(`/tasks/${encodeURIComponent(id)}`)).data
}
