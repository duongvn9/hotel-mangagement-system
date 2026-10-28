import { api } from '@/lib/api-client'
import type { RoomStatus } from '@/features/rooms/api'
import type { TaskStatus } from '@/features/tasks/api'

export interface MaintenanceTargets {
  rooms: { id: string; roomNumber: string; floor: number; status: RoomStatus }[]
  equipment: {
    id: string
    assetCode: string
    name: string
    category: string
    location: string
    roomId: string | null
    roomNumber: string | null
  }[]
}
export interface FaultInput {
  roomId?: string
  equipmentId?: string
  facilityLocation?: string
  description: string
  requiresAction: boolean
  preventsSafeUse: boolean
}
export interface ReportReceipt {
  reportId: string
  taskId?: string
  roomMarkedUnavailable: boolean
  warnings: string[]
}
export async function searchTargets(q: string): Promise<MaintenanceTargets> {
  return (await api.get<MaintenanceTargets>('/maintenance/targets', { params: { q: q.trim() } }))
    .data
}
export async function reportFault(input: FaultInput, key: string): Promise<ReportReceipt> {
  return (
    await api.post<ReportReceipt>('/maintenance/reports', input, {
      headers: { 'Idempotency-Key': key },
    })
  ).data
}

export type HistoryStatus = TaskStatus | 'NO_ACTION' | null
export interface HistoryQuery {
  q?: string
  status?: Exclude<HistoryStatus, null>
  from?: string
  to?: string
  page: number
  limit: number
  sort: 'asc' | 'desc'
}
export interface HistoryItem {
  id: string
  reportedAt: string
  description: string
  requiresAction: boolean
  preventsSafeUse: boolean
  status: HistoryStatus
  completedAt?: string
  target: {
    room: { id: string; roomNumber: string; floor: number } | null
    equipment: {
      id: string
      assetCode: string
      name: string
      category?: string
      location?: string
    } | null
    facilityLocation: string | null
  }
}
export interface HistoryDetail extends HistoryItem {
  reportedBy: { id: string; fullName: string }
  task: {
    id: string
    title: string
    priority: string
    status: TaskStatus
    assignee: { id: string; fullName: string }
    assignedAt: string
    dueAt?: string
    completedAt?: string
    workResult?: string
  } | null
}
export interface HistoryPage {
  items: HistoryItem[]
  total: number
  page: number
  limit: number
}
export async function listMaintenanceHistory(query: HistoryQuery): Promise<HistoryPage> {
  return (await api.get<HistoryPage>('/maintenance/history', { params: query })).data
}
export async function getMaintenanceHistory(id: string): Promise<HistoryDetail> {
  return (await api.get<HistoryDetail>(`/maintenance/history/${encodeURIComponent(id)}`)).data
}
