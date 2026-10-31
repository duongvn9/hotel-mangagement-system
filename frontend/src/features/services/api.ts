import { api } from '@/lib/api-client'
export interface Service {
  imageUrl?: string
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
export type ServiceInput = Omit<Service, 'id'>
export async function getService(id: string): Promise<Service> {
  return (await api.get<Service>(`/services/${id}`)).data
}
export async function createService(input: ServiceInput): Promise<Service> {
  return (await api.post<Service>('/services', input)).data
}
export async function updateService(id: string, input: Partial<ServiceInput>): Promise<Service> {
  return (await api.patch<Service>(`/services/${id}`, input)).data
}
