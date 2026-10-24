import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/auth-context'
import { api } from '@/lib/api-client'
import type { ServiceOrder } from './api'

export interface ServiceHistory extends ServiceOrder {
  task: {
    id: string
    status: string
    assignedAt: string
    completedAt: string
    workResult: string
    dueAt?: string
  }
}
export interface HistoryQuery {
  keyword?: string
  from?: string
  to?: string
  page: number
  limit: number
}
export interface HistoryPage {
  items: ServiceHistory[]
  total: number
  page: number
  limit: number
}
export const historyKeys = {
  scope: (id?: string, role?: string) => ['service-history', id, role] as const,
  list: (id: string | undefined, role: string | undefined, query: HistoryQuery) =>
    [...historyKeys.scope(id, role), 'list', query] as const,
  detail: (id: string | undefined, role: string | undefined, orderId: string) =>
    [...historyKeys.scope(id, role), 'detail', orderId] as const,
}
export function useServiceHistory(query: HistoryQuery) {
  const { me } = useAuth()
  return useQuery({
    queryKey: historyKeys.list(me?.id, me?.role, query),
    queryFn: async () =>
      (await api.get<HistoryPage>('/service-orders/history/me', { params: query })).data,
    enabled: me?.role === 'SERVICE_STAFF',
    retry: false,
  })
}
export function useServiceHistoryDetail(id: string) {
  const { me } = useAuth()
  return useQuery({
    queryKey: historyKeys.detail(me?.id, me?.role, id),
    queryFn: async () =>
      (await api.get<ServiceHistory>(`/service-orders/history/${encodeURIComponent(id)}`)).data,
    enabled: me?.role === 'SERVICE_STAFF' && Boolean(id),
    retry: false,
  })
}
