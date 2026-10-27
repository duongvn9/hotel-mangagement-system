import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/auth-context'
import { getManagerDashboard, getReceptionDashboard } from './api'
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

/** Số liệu của hôm nay thay đổi liên tục nên tự làm mới mỗi phút và khi quay lại tab. */
export function useReceptionDashboard() {
  const { me } = useAuth()
  return useQuery({
    queryKey: ['reception-dashboard', me?.id],
    queryFn: getReceptionDashboard,
    staleTime: 0,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    retry: false,
  })
}
