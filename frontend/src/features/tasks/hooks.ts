import { useQuery } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { useAuth } from '@/features/auth/auth-context'
import { getAssignedTask, listAssignedTasks, type TaskQuery } from './api'

function retryTask(failureCount: number, error: unknown) {
  const status = isAxiosError(error) ? error.response?.status : undefined
  if (status && status >= 400 && status < 500) return false
  return failureCount < 2
}

export function useAssignedTasks(query: TaskQuery) {
  const { me } = useAuth()
  return useQuery({
    queryKey: ['assigned-tasks', me?.id, query],
    queryFn: () => listAssignedTasks(query),
    enabled: Boolean(me),
    retry: retryTask,
  })
}

export function useAssignedTask(id: string) {
  const { me } = useAuth()
  return useQuery({
    queryKey: ['assigned-task', me?.id, id],
    queryFn: () => getAssignedTask(id),
    enabled: Boolean(me && id),
    retry: retryTask,
  })
}
