import { useQuery } from '@tanstack/react-query'
import { activeRoomTypeOptions, listRooms, roomTypeOptions, type RoomQuery } from './api'

export function useRooms(query: RoomQuery) {
  return useQuery({ queryKey: ['rooms', query], queryFn: () => listRooms(query) })
}
export function useRoomTypeOptions() {
  return useQuery({ queryKey: ['room-type-options'], queryFn: roomTypeOptions })
}
export function useActiveRoomTypeOptions() {
  return useQuery({ queryKey: ['room-types', 'options'], queryFn: activeRoomTypeOptions })
}
