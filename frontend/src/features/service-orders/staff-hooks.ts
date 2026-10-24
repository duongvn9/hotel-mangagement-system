import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/auth-context'
import { normalizeOrderQuery, type OrderQuery } from './api'
import { getStaffOrder, listStaffOrders, reviewStaffOrder, type ReviewInput } from './staff-api'

export const staffOrderKeys = {
  scope: (id?: string, role?: string) => ['staff-service-orders', id, role] as const,
  list: (id: string | undefined, role: string | undefined, query: OrderQuery) =>
    [...staffOrderKeys.scope(id, role), 'list', normalizeOrderQuery(query)] as const,
  detail: (id: string | undefined, role: string | undefined, orderId: string) =>
    [...staffOrderKeys.scope(id, role), 'detail', orderId] as const,
}
export function useStaffOrders(query: OrderQuery) {
  const { me } = useAuth()
  return useQuery({
    queryKey: staffOrderKeys.list(me?.id, me?.role, query),
    queryFn: () => listStaffOrders(query),
    enabled: me?.role === 'RECEPTIONIST',
    retry: false,
  })
}
export function useStaffOrder(id: string) {
  const { me } = useAuth()
  return useQuery({
    queryKey: staffOrderKeys.detail(me?.id, me?.role, id),
    queryFn: () => getStaffOrder(id),
    enabled: me?.role === 'RECEPTIONIST' && Boolean(id),
    retry: false,
  })
}
export function useReviewStaffOrder(id: string) {
  const { me } = useAuth()
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: ReviewInput) => {
      if (me?.role !== 'RECEPTIONIST') throw new Error('Không có quyền truy cập')
      return reviewStaffOrder(id, input)
    },
    retry: false,
    onSuccess: (order) => {
      client.setQueryData(staffOrderKeys.detail(me?.id, me?.role, id), order)
    },
    onSettled: async () => {
      await client.invalidateQueries({ queryKey: staffOrderKeys.scope(me?.id, me?.role) })
    },
  })
}
