import { useQuery } from '@tanstack/react-query'
import { listAmenities, type AmenityQuery } from './api'
export function useAmenities(query: AmenityQuery) {
  return useQuery({ queryKey: ['amenities', query], queryFn: () => listAmenities(query) })
}
