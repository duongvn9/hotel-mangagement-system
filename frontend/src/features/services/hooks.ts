import { useQuery } from '@tanstack/react-query'
import { listServices, type ServiceQuery } from './api'
export function useServices(query: ServiceQuery) {
  return useQuery({ queryKey: ['services', query], queryFn: () => listServices(query) })
}
