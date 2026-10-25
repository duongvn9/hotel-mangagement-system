import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/auth-context'
import {
  getQueueSummary,
  listQueueTasks,
  getQueueTask,
  type QueueFilters,
  type QueueQuery,
} from './api'

// Live monitoring: no interval. Focus and manual refresh obtain a new server snapshot.
const live = { staleTime: 0, refetchOnWindowFocus: true, retry: false } as const
export function useQueueSummary(filters: QueueFilters) {
  const { me } = useAuth()
  return useQuery({
    queryKey: ['task-queue-summary', me?.id, filters],
    queryFn: () => getQueueSummary(filters),
    placeholderData: keepPreviousData,
    ...live,
  })
}
export function useQueueTasks(query: QueueQuery) {
  const { me } = useAuth()
  return useQuery({
    queryKey: ['task-queue-tasks', me?.id, query],
    queryFn: () => listQueueTasks(query),
    ...live,
  })
}
export function useQueueTask(id: string) {
  const { me } = useAuth()
  return useQuery({
    queryKey: ['task-queue-detail', me?.id, id],
    queryFn: () => getQueueTask(id),
    ...live,
  })
}
