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
export interface AmenityInput {
  name: string
  description?: string
  isActive?: boolean
  roomTypeIds?: string[]
}
export async function getAmenity(id: string): Promise<Amenity> {
  return (await api.get<Amenity>(`/amenities/${id}`)).data
}
export async function createAmenity(input: AmenityInput): Promise<Amenity> {
  return (await api.post<Amenity>('/amenities', input)).data
}
export async function updateAmenity(id: string, input: Partial<AmenityInput>): Promise<Amenity> {
  return (await api.patch<Amenity>(`/amenities/${id}`, input)).data
}
export async function amenityRoomTypeOptions(): Promise<Pick<AmenityRoomType, 'id' | 'name'>[]> {
  return (await api.get<Pick<AmenityRoomType, 'id' | 'name'>[]>('/room-types/options')).data
}
