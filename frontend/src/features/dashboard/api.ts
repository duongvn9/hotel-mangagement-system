import { api } from '@/lib/api-client'
import type { RoomStatus } from '@/features/rooms/api'
export type DashboardBlock<T> =
  ({ available: true } & T) | { available: false; reason: 'error' | 'not_available' }
export interface ManagerDashboard {
  generatedAt: string
  tasks: DashboardBlock<{
    counts: { assigned: number; inProgress: number; completed: number }
    overdue: number
  }>
  rooms: DashboardBlock<{ asOf: string; activeTotal: number; byStatus: Record<RoomStatus, number> }>
  revenue: DashboardBlock<{
    period: { from: string; to: string; timezone: string }
    successCount: number
    successAmount: number
  }>
}
export const getManagerDashboard = async () =>
  (await api.get<ManagerDashboard>('/dashboard/manager')).data
