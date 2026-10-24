import { api } from '@/lib/api-client'
export interface Service {
  id: string
  name: string
  description: string
  unit: string
  billable: boolean
  price: number | null
  isActive: boolean
}
export interface ServiceQuery {
  search?: string
  billable?: boolean
  isActive?: boolean
  page: number
  limit: number
  sortBy?: 'name' | 'price' | 'createdAt'
  sortOrder?: 'asc' | 'desc'
}
export interface ServiceList {
  items: Service[]
  total: number
  page: number
  limit: number
}
export async function listServices(query: ServiceQuery): Promise<ServiceList> {
  return (await api.get<ServiceList>('/services', { params: query })).data
}
