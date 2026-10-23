import { api } from '@/lib/api-client'

export interface RoomType {
  id: string
  name: string
  description: string
  capacity: number
  basePrice: number
  amenities: { id: string; name: string; isActive?: boolean }[]
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

export interface RoomTypeInput {
  name: string
  description: string
  capacity: number
  basePrice: number
  amenities: string[]
  isActive: boolean
}

export async function getRoomType(id: string): Promise<RoomType> {
  return (await api.get<RoomType>(`/room-types/${id}`)).data
}
export async function getAmenityOptions(): Promise<{ id: string; name: string }[]> {
  return (await api.get<{ id: string; name: string }[]>('/amenities/options')).data
}
export async function createRoomType(input: RoomTypeInput): Promise<RoomType> {
  return (await api.post<RoomType>('/room-types', input)).data
}
export async function updateRoomType(id: string, input: Partial<RoomTypeInput>): Promise<RoomType> {
  return (await api.patch<RoomType>(`/room-types/${id}`, input)).data
}
