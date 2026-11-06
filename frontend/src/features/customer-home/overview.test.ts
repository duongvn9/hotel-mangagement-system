import { describe, expect, it } from 'vitest'
import type { MyBookingItem } from '@/features/booking/api'
import { givenName, greetingFor, summarizeBookings } from './overview'

const booking = (overrides: Partial<MyBookingItem> = {}): MyBookingItem => ({
  id: 'b1',
  code: 'BK-1',
  status: 'CONFIRMED',
  checkIn: '2026-12-01T00:00:00.000Z',
  checkOut: '2026-12-03T00:00:00.000Z',
  adultCount: 2,
  childCount: 0,
  roomCount: 1,
  roomTotal: 2_000_000,
  depositAmount: 600_000,
  createdAt: '2026-11-01T00:00:00.000Z',
  ...overrides,
})

const TODAY = '2026-11-06'

describe('summarizeBookings', () => {
  it('counts every booking except ROOM_HELD, CANCELLED and EXPIRED', () => {
    const summary = summarizeBookings(
      [
        booking({ id: '1', status: 'ROOM_HELD' }),
        booking({ id: '2', status: 'CANCELLED' }),
        booking({ id: '3', status: 'EXPIRED' }),
        booking({ id: '4', status: 'CONFIRMED' }),
        booking({ id: '5', status: 'CHECKED_OUT' }),
      ],
      TODAY,
    )
    expect(summary.bookingCount).toBe(2)
  })

  it('sums the nights of CHECKED_OUT bookings only', () => {
    const summary = summarizeBookings(
      [
        booking({
          id: '1',
          status: 'CHECKED_OUT',
          checkIn: '2026-01-01T00:00:00.000Z',
          checkOut: '2026-01-04T00:00:00.000Z',
        }),
        booking({
          id: '2',
          status: 'CHECKED_OUT',
          checkIn: '2026-02-01T00:00:00.000Z',
          checkOut: '2026-02-03T00:00:00.000Z',
        }),
        booking({
          id: '3',
          status: 'CONFIRMED',
          checkIn: '2026-12-01T00:00:00.000Z',
          checkOut: '2026-12-06T00:00:00.000Z',
        }),
      ],
      TODAY,
    )
    expect(summary.nightsStayed).toBe(5)
  })

  it('picks the earliest upcoming CONFIRMED, CHECKED_IN or PENDING_DEPOSIT booking', () => {
    const summary = summarizeBookings(
      [
        booking({
          id: 'late',
          checkIn: '2026-12-20T00:00:00.000Z',
          checkOut: '2026-12-22T00:00:00.000Z',
        }),
        booking({
          id: 'early',
          status: 'PENDING_DEPOSIT',
          checkIn: '2026-11-20T00:00:00.000Z',
          checkOut: '2026-11-22T00:00:00.000Z',
        }),
        booking({
          id: 'held',
          status: 'ROOM_HELD',
          checkIn: '2026-11-10T00:00:00.000Z',
          checkOut: '2026-11-12T00:00:00.000Z',
        }),
      ],
      TODAY,
    )
    expect(summary.next?.id).toBe('early')
  })

  it('ignores bookings whose checkout date is before today', () => {
    const summary = summarizeBookings(
      [booking({ checkIn: '2026-11-01T00:00:00.000Z', checkOut: '2026-11-05T00:00:00.000Z' })],
      TODAY,
    )
    expect(summary.next).toBeUndefined()
  })

  it('keeps a checked-in stay that ends today', () => {
    const summary = summarizeBookings(
      [
        booking({
          id: 'now',
          status: 'CHECKED_IN',
          checkIn: '2026-11-04T00:00:00.000Z',
          checkOut: '2026-11-06T00:00:00.000Z',
        }),
      ],
      TODAY,
    )
    expect(summary.next?.id).toBe('now')
  })

  it('returns zeros and no next stay for an empty list', () => {
    expect(summarizeBookings([], TODAY)).toEqual({
      bookingCount: 0,
      nightsStayed: 0,
      paidTotal: undefined,
      next: undefined,
    })
  })

  it('sums paidAmount when the API provides it and skips uncounted bookings', () => {
    const summary = summarizeBookings(
      [
        booking({ id: '1', paidAmount: 500_000 }),
        booking({ id: '2', paidAmount: 250_000 }),
        booking({ id: '3', status: 'CANCELLED', paidAmount: 999_999 }),
      ],
      TODAY,
    )
    expect(summary.paidTotal).toBe(750_000)
  })
})

describe('greetingFor', () => {
  it.each([
    [4, 'Chào buổi tối'],
    [5, 'Chào buổi sáng'],
    [10, 'Chào buổi sáng'],
    [11, 'Chào buổi trưa'],
    [12, 'Chào buổi trưa'],
    [13, 'Chào buổi chiều'],
    [17, 'Chào buổi chiều'],
    [18, 'Chào buổi tối'],
    [23, 'Chào buổi tối'],
  ])('at %i o’clock says %s', (hour, expected) => {
    expect(greetingFor(hour)).toBe(expected)
  })
})

describe('givenName', () => {
  it('takes the last word of the full name', () => {
    expect(givenName('Nguyễn Minh Anh')).toBe('Anh')
    expect(givenName('Anh')).toBe('Anh')
    expect(givenName('  ')).toBe('')
    expect(givenName('Trần  Văn  Bình ')).toBe('Bình')
  })
})
