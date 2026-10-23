import { useQuery } from '@tanstack/react-query'
import { listRoomTypes, type RoomTypeQuery } from './api'

export function useRoomTypes(query: RoomTypeQuery) {
  return useQuery({ queryKey: ['room-types', query], queryFn: () => listRoomTypes(query) })
}
