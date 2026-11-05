import { describe, expect, it } from 'vitest'
import type { AvailableRoom } from '@/features/booking/api'
import { featuredRoomTypes } from './featured'

describe('featuredRoomTypes', () => {
  it('returns empty array when rooms list is empty', () => {
    expect(featuredRoomTypes([])).toEqual([])
  })

  it('skips rooms without a roomTypeId', () => {
    const rooms = [
      { id: '1', roomTypeId: '', capacity: 2 },
      { id: '2', roomTypeId: 't1', roomTypeName: 'Deluxe', capacity: 2, pricePerNight: 1000000 },
    ] as AvailableRoom[]
    const result = featuredRoomTypes(rooms)
    expect(result).toHaveLength(1)
    expect(result[0].roomTypeId).toBe('t1')
  })

  it('groups rooms by roomTypeId and counts free rooms', () => {
    const rooms: AvailableRoom[] = [
      { id: '101', roomTypeId: 't1', roomTypeName: 'Deluxe', capacity: 2, pricePerNight: 1200000 },
      { id: '102', roomTypeId: 't1', roomTypeName: 'Deluxe', capacity: 2, pricePerNight: 1200000 },
      { id: '201', roomTypeId: 't2', roomTypeName: 'Suite', capacity: 4, pricePerNight: 2500000 },
    ]
    const result = featuredRoomTypes(rooms)
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({
      roomTypeId: 't1',
      name: 'Deluxe',
      price: 1200000,
      image: undefined,
      freeCount: 2,
    })
    expect(result[1]).toEqual({
      roomTypeId: 't2',
      name: 'Suite',
      price: 2500000,
      image: undefined,
      freeCount: 1,
    })
  })

  it('preserves order of first appearance and caps at 3 room types', () => {
    const rooms: AvailableRoom[] = [
      { id: '1', roomTypeId: 't1', roomTypeName: 'Type 1', capacity: 2 },
      { id: '2', roomTypeId: 't2', roomTypeName: 'Type 2', capacity: 2 },
      { id: '3', roomTypeId: 't3', roomTypeName: 'Type 3', capacity: 2 },
      { id: '4', roomTypeId: 't4', roomTypeName: 'Type 4', capacity: 2 },
    ]
    const result = featuredRoomTypes(rooms)
    expect(result).toHaveLength(3)
    expect(result.map((r) => r.roomTypeId)).toEqual(['t1', 't2', 't3'])
  })
})
