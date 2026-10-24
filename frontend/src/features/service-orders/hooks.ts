import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/auth-context'
import {
  createOrder,
  getOrder,
  getOrderCatalog,
  getOrderContexts,
  listOrders,
  normalizeOrderQuery,
  type OrderQuery,
} from './api'

export const orderKeys = {
  scope: (id?: string, role?: string) => ['service-orders', id, role] as const,
  list: (id: string | undefined, role: string | undefined, query: OrderQuery) =>
    [...orderKeys.scope(id, role), 'list', normalizeOrderQuery(query)] as const,
  detail: (id: string | undefined, role: string | undefined, orderId: string) =>
    [...orderKeys.scope(id, role), 'detail', orderId] as const,
}
export function useOrderChoices() {
  const { me } = useAuth()
  const options = { enabled: me?.role === 'CUSTOMER', retry: false }
  const contexts = useQuery({
    ...options,
    queryKey: [...orderKeys.scope(me?.id, me?.role), 'contexts'],
    queryFn: getOrderContexts,
  })
  const catalog = useQuery({
    ...options,
    queryKey: [...orderKeys.scope(me?.id, me?.role), 'catalog'],
    queryFn: getOrderCatalog,
  })
  return { contexts, catalog }
}
export function useOrders(query: OrderQuery) {
  const { me } = useAuth()
  return useQuery({
    queryKey: orderKeys.list(me?.id, me?.role, query),
    queryFn: () => listOrders(query),
    enabled: me?.role === 'CUSTOMER',
    retry: false,
  })
}
export function useOrder(id: string) {
  const { me } = useAuth()
  return useQuery({
    queryKey: orderKeys.detail(me?.id, me?.role, id),
    queryFn: () => getOrder(id),
    enabled: me?.role === 'CUSTOMER' && Boolean(id),
    retry: false,
  })
}
export function useCreateOrder() {
  const { me } = useAuth()
  const client = useQueryClient()
  return useMutation({
    mutationFn: createOrder,
    retry: false,
    onSuccess: (order) => {
      client.setQueryData(orderKeys.detail(me?.id, me?.role, order.id), order)
      void client.invalidateQueries({ queryKey: orderKeys.scope(me?.id, me?.role) })
    },
  })
}
