import { useQuery } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { useAuth } from '@/features/auth/auth-context'
import { DashboardReadError, readStaffDashboard } from './api'

export const staffDashboardKey = (userId: string | undefined, role: string | undefined) =>
  ['assigned-tasks', userId, 'dashboard', role] as const

export function useStaffDashboard() {
  const { me, status } = useAuth()
  return useQuery({
    queryKey: staffDashboardKey(me?.id, me?.role),
    queryFn: ({ signal }) => readStaffDashboard(signal),
    enabled:
      status === 'authenticated' &&
      Boolean(me) &&
      ['SERVICE_STAFF', 'OPERATIONS_STAFF'].includes(me!.role),
    retry: (count, error) => {
      if (error instanceof DashboardReadError) return false
      const code = isAxiosError(error) ? error.response?.status : undefined
      return !(code && code >= 400 && code < 500) && count < 2
    },
  })
}
