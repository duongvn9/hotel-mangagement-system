import { api } from '@/lib/api-client'
import type { RoomStatus } from '@/features/rooms/api'

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
