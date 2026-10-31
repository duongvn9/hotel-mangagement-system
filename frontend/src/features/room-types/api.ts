import { api } from '@/lib/api-client'

export interface RoomType {
  images?: string[]
  id: string
  name: string
  description: string
  adultCapacity: number
  childCapacity: number
  basePrice: number
  amenities: { id: string; name: string; iconUrl?: string; isActive?: boolean }[]
  isActive: boolean
  availableForBooking: boolean
}

export interface RoomTypeQuery {
  search?: string
  isActive?: boolean
  page: number
  limit: number
  sortBy?: 'name' | 'basePrice' | 'adultCapacity' | 'childCapacity'
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
  images?: string[]
  name: string
  description: string
  adultCapacity: number
  childCapacity: number
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
