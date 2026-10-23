import { api } from '@/lib/api-client'

export interface RoomType {
  id: string
  name: string
  description: string
  capacity: number
  basePrice: number
  amenities: { id: string; name: string }[]
  isActive: boolean
  availableForBooking: boolean
}

export interface RoomTypeQuery {
  search?: string
  isActive?: boolean
  page: number
  limit: number
  sortBy?: 'name' | 'basePrice' | 'capacity'
  sortOrder?: 'asc' | 'desc'
}

export interface RoomTypeList {
  items: RoomType[]
  total: number
  page: number
  limit: number
}

export async function listRoomTypes(query: RoomTypeQuery): Promise<RoomTypeList> {
  return (await api.get<RoomTypeList>('/room-types', { params: query })).data
}
