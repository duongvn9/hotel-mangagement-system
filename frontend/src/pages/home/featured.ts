import type { AvailableRoom } from '@/features/booking/api'

export interface FeaturedRoomType {
  roomTypeId: string
  name: string
  price?: number
  image?: string
  freeCount: number
}

export function featuredRoomTypes(rooms: AvailableRoom[]): FeaturedRoomType[] {
  if (!rooms || rooms.length === 0) return []

  const map = new Map<string, FeaturedRoomType>()

  for (const r of rooms) {
    if (!r.roomTypeId) continue
    const existing = map.get(r.roomTypeId)
    if (!existing) {
      map.set(r.roomTypeId, {
        roomTypeId: r.roomTypeId,
        name: r.roomTypeName || 'Phòng nghỉ',
        price: r.pricePerNight,
        image: r.images?.[0],
        freeCount: 1,
      })
    } else {
      existing.freeCount += 1
      if (!existing.image && r.images?.[0]) {
        existing.image = r.images[0]
      }
      if (existing.price === undefined && r.pricePerNight !== undefined) {
        existing.price = r.pricePerNight
      }
    }
  }

  return Array.from(map.values()).slice(0, 3)
}
