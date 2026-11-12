import { api } from '@/lib/api-client'

export interface BedTypeRoomType {
  id: string
  name: string
  isActive: boolean
}

export interface BedType {
  id: string
  name: string
  description: string
  isActive: boolean
  roomTypes: BedTypeRoomType[]
  roomTypeCount: number
}

export interface BedTypeQuery {
  search?: string
  isActive?: boolean
  page: number
  limit: number
  sortBy?: 'name' | 'createdAt'
  sortOrder?: 'asc' | 'desc'
}

export interface BedTypeList {
  items: BedType[]
  total: number
  page: number
  limit: number
}

export interface BedTypeInput {
  name: string
  description?: string
  isActive?: boolean
}

export async function listBedTypes(query: BedTypeQuery): Promise<BedTypeList> {
  return (await api.get<BedTypeList>('/bed-types', { params: query })).data
}

export async function getBedType(id: string): Promise<BedType> {
  return (await api.get<BedType>(`/bed-types/${id}`)).data
}

export async function createBedType(input: BedTypeInput): Promise<BedType> {
  return (await api.post<BedType>('/bed-types', input)).data
}

export async function updateBedType(id: string, input: Partial<BedTypeInput>): Promise<BedType> {
  return (await api.patch<BedType>(`/bed-types/${id}`, input)).data
}

export async function bedTypeOptions(): Promise<Pick<BedType, 'id' | 'name'>[]> {
  return (await api.get<Pick<BedType, 'id' | 'name'>[]>('/bed-types/options')).data
}
