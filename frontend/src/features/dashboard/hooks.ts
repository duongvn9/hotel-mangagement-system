import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/auth-context'
import { getManagerDashboard } from './api'
export function useManagerDashboard() {
  const { me } = useAuth()
  return useQuery({
    queryKey: ['manager-dashboard', me?.id],
    queryFn: getManagerDashboard,
    staleTime: 0,
    refetchOnWindowFocus: true,
    retry: false,
  })
}
