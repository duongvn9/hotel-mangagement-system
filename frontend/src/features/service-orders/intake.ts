import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { useAuth } from '@/features/auth/auth-context'
import type { CatalogService, OrderInput, OrderContext, OrderQuery } from './api'
import type { ServiceAssignee, StaffOrderPage, StaffServiceOrder } from './staff-api'

export interface IntakeContext extends OrderContext {
  guestName: string
  guestPhone?: string
  rooms: { id: string; roomNumber: string | null }[]
}
export interface IntakeInput extends OrderInput {
  requestId: string
  intakeMode: 'UNPERFORMED' | 'COMPLETED_ON_SITE'
  roomId?: string
  requesterName?: string
  actualPerformerId?: string
  actualCompletedAt?: string
  completionDetails?: string
}
export function useIntakeChoices(completed: boolean) {
  const { me } = useAuth()
  const enabled = me?.role === 'RECEPTIONIST' || me?.role === 'SERVICE_STAFF'
  const contexts = useQuery({
    queryKey: ['service-intake', me?.id, me?.role, 'contexts'],
    queryFn: async () =>
      (await api.get<{ items: IntakeContext[] }>('/service-orders/intake/contexts')).data,
    enabled,
    retry: false,
  })
  const catalog = useQuery({
    queryKey: ['service-intake', me?.id, me?.role, 'catalog'],
    queryFn: async () =>
      (await api.get<{ items: CatalogService[] }>('/service-orders/intake/catalog')).data,
    enabled,
    retry: false,
  })
  const performers = useQuery({
    queryKey: ['service-intake', me?.id, me?.role, 'performers'],
    queryFn: async () =>
      (await api.get<{ items: ServiceAssignee[] }>('/service-orders/intake/performers')).data,
    enabled: me?.role === 'SERVICE_STAFF' && completed,
    retry: false,
  })
  return { contexts, catalog, performers }
}
export function useIntake() {
  const { me } = useAuth()
  const client = useQueryClient()
  return useMutation({
    mutationFn: async (input: IntakeInput) => {
      if (me?.role !== 'RECEPTIONIST' && me?.role !== 'SERVICE_STAFF')
        throw new Error('Không có quyền truy cập')
      return (await api.post<StaffServiceOrder>('/service-orders/intake', input)).data
    },
    retry: false,
    onSuccess: async () => {
      await Promise.all(
        ['staff-service-orders', 'service-reports', 'service-history'].map((key) =>
          client.invalidateQueries({ queryKey: [key] }),
        ),
      )
    },
  })
}
export function useServiceReports(query: OrderQuery) {
  const { me } = useAuth()
  return useQuery({
    queryKey: ['service-reports', me?.id, me?.role, query],
    queryFn: async () =>
      (await api.get<StaffOrderPage>('/service-orders/reports/me', { params: query })).data,
    enabled: me?.role === 'SERVICE_STAFF',
    retry: false,
  })
}
export function useServiceReport(id: string) {
  const { me } = useAuth()
  return useQuery({
    queryKey: ['service-reports', me?.id, me?.role, 'detail', id],
    queryFn: async () =>
      (await api.get<StaffServiceOrder>(`/service-orders/reports/${encodeURIComponent(id)}`)).data,
    enabled: me?.role === 'SERVICE_STAFF' && Boolean(id),
    retry: false,
  })
}
