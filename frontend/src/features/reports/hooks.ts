import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/auth-context'
import { getRevenueReport, type RevenueQuery } from './api'
export function useRevenueReport(query: RevenueQuery, enabled: boolean) {
  const { me } = useAuth()
  return useQuery({
    queryKey: ['reports-revenue', me?.id, query],
    queryFn: () => getRevenueReport(query),
    enabled,
    staleTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  })
}
