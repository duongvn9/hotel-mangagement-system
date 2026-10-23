import { api } from '@/lib/api-client'
import { listRoomTypes } from '@/features/room-types/api'

export const ROOM_STATUSES = ['AVAILABLE', 'OCCUPIED', 'CLEANING', 'MAINTENANCE'] as const
export type RoomStatus = (typeof ROOM_STATUSES)[number]
export interface RoomTypeOption {
  id: string
  name: string
  isActive: boolean
}
export interface Room {
  id: string
  roomNumber: string
  floor: number
  roomType: RoomTypeOption | null
  status: RoomStatus
  notes: string
  isActive: boolean
}
export interface RoomQuery {
  search?: string
  roomTypeId?: string
  status?: RoomStatus
  isActive?: boolean
  floor?: number
  page: number
  limit: number
  sortBy?: 'roomNumber' | 'floor' | 'status'
  sortOrder?: 'asc' | 'desc'
}
export interface RoomList {
  items: Room[]
  total: number
  page: number
  limit: number
}
export async function listRooms(query: RoomQuery): Promise<RoomList> {
  return (await api.get<RoomList>('/rooms', { params: query })).data
}

/** Load every page, including inactive types, rather than silently truncating the filter. */
export async function roomTypeOptions(): Promise<RoomTypeOption[]> {
  const first = await listRoomTypes({ page: 1, limit: 100 })
  const items = [...first.items]
  for (let page = 2; page <= Math.ceil(first.total / first.limit); page++) {
    const result = await listRoomTypes({ page, limit: 100 })
    items.push(...result.items)
  }
  return [
    ...new Map(
      items.map((item) => [item.id, { id: item.id, name: item.name, isActive: item.isActive }]),
    ).values(),
  ]
}
