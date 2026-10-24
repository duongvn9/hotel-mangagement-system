import { api } from '@/lib/api-client'
export interface AmenityRoomType {
  id: string
  name: string
  isActive: boolean
}
export interface Amenity {
  id: string
  name: string
  description: string
  isActive: boolean
  roomTypes: AmenityRoomType[]
  roomTypeCount: number
}
export interface AmenityQuery {
  search?: string
  isActive?: boolean
  page: number
  limit: number
  sortBy?: 'name' | 'createdAt'
  sortOrder?: 'asc' | 'desc'
}
export interface AmenityList {
  items: Amenity[]
  total: number
  page: number
  limit: number
}
export async function listAmenities(query: AmenityQuery): Promise<AmenityList> {
  return (await api.get<AmenityList>('/amenities', { params: query })).data
}
