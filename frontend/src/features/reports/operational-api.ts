import { api } from '@/lib/api-client'
export interface OperationalQuery {
  from: string
  to: string
  granularity: 'day' | 'month'
}
type Source<T> = ({ available: true } & T) | { available: false; reason: 'not_available' }
export interface OperationalBucket {
  bucket: string
  bookingsCreated: number
  checkIns: number
  serviceOrdersCreated: number
  issuesReported: number
  maintenanceReported: number
  tasksCompleted: number
}
export interface OperationalReport {
  period: OperationalQuery & { timezone: string; days: number }
  generatedAt: string
  hasPeriodData: boolean
  bookings: Source<{ created: number; checkedIn: number; checkedOut: number; cancelled: number }>
  occupancy: Source<{
    occupiedRoomNights: number
    availableRoomNights: number
    rate: number | null
    note: string
  }>
  roomsSnapshot: Source<{ asOf: string; activeTotal: number; byStatus: Record<string, number> }>
  serviceOrders: Source<{
    created: number
    byReviewStatus: Record<string, number>
    byExecutionStatus: Record<string, number>
  }>
  issues: Source<{
    reported: number
    closed: number
    byStatus: Record<string, number>
    byCategory: { category: string; count: number }[]
    avgResolutionHours: number | null
  }>
  maintenance: Source<{
    reported: number
    preventsSafeUse: number
    requiresAction: number
    byStatus: Record<string, number>
    unknownStatus: number
  }>
  tasks: Source<{
    period: {
      assigned: number
      completed: number
      byTaskType: { taskType: string; count: number }[]
      bySourceType: { sourceType: string; count: number }[]
      avgCompletionHours: number | null
    }
    snapshot: { asOf: string; assigned: number; inProgress: number; overdue: number }
  }>
  series: OperationalBucket[]
}
export const getOperationalReport = async (query: OperationalQuery) =>
  (await api.get<OperationalReport>('/reports/operational', { params: query })).data
