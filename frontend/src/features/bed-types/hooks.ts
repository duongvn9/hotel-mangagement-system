import { useQuery } from '@tanstack/react-query'
import { listBedTypes, type BedTypeQuery } from './api'

export function useBedTypes(query: BedTypeQuery) {
  return useQuery({ queryKey: ['bed-types', query], queryFn: () => listBedTypes(query) })
}
