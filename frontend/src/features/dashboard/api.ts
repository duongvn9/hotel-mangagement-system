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

export interface ReceptionDashboard {
  generatedAt: string
  /** Đến và đi của hôm nay (giờ Việt Nam), tổng hợp từ UC15. */
  frontDesk: DashboardBlock<{
    date: string
    arrivals: { total: number; awaitingDeposit: number; ready: number; checkedIn: number }
    departures: { total: number; awaitingCheckOut: number; checkedOut: number }
  }>
  /** Trạng thái phòng của hôm nay, tổng hợp từ UC13. */
  rooms: DashboardBlock<{
    date: string
    total: number
    free: number
    held: number
    reserved: number
    inHouse: number
    maintenance: number
    cleaning: number
  }>
  /** Việc đang chờ lễ tân xử lý. */
  requests: DashboardBlock<{
    serviceOrdersPendingReview: number
    issuesPendingReview: number
    feedbackUnreplied: number
  }>
}
export const getReceptionDashboard = async () =>
  (await api.get<ReceptionDashboard>('/dashboard/reception')).data
