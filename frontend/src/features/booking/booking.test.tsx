import { fireEvent, screen } from '@testing-library/react'
import { api } from '@/lib/api-client'
import { renderWithAuth } from '@/features/auth/test-utils'
import { bookingRoutes } from './routes'
import type { AvailableRoom } from './api'
import {
  getStoredBooking,
  listStoredBookings,
  lookupPaymentRef,
  patchStoredBooking,
  rememberPaymentRef,
  removeStoredBooking,
  upsertStoredBooking,
} from './storage'
import { nightsBetween, todayISO } from './utils'

const booking = {
  id: 'b1',
  code: 'BK123',
  status: 'PENDING_DEPOSIT',
  rooms: ['r1'],
  checkIn: '2099-01-10',
  checkOut: '2099-01-12',
  guests: 2,
  roomTotal: 2_000_000,
  depositAmount: 600_000,
  holdExpiresAt: '2099-01-10T00:00:00.000Z',
}

describe('booking utils', () => {
  it('counts nights between two business dates', () => {
    expect(nightsBetween('2099-01-10', '2099-01-12')).toBe(2)
    expect(nightsBetween('2099-01-10', '2099-01-10')).toBe(0)
    // checkOut trước checkIn không âm.
    expect(nightsBetween('2099-01-12', '2099-01-10')).toBe(0)
  })

  it('formats today as YYYY-MM-DD', () => {
    expect(todayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('booking storage', () => {
  beforeEach(() => localStorage.clear())

  it('upserts, reads and removes stored bookings', () => {
    upsertStoredBooking(booking)
    expect(listStoredBookings()).toHaveLength(1)
    expect(getStoredBooking('b1')?.code).toBe('BK123')

    // Upsert lại cùng id không nhân đôi, giữ cập nhật.
    upsertStoredBooking({ ...booking, status: 'CONFIRMED' })
    expect(listStoredBookings()).toHaveLength(1)
    expect(getStoredBooking('b1')?.status).toBe('CONFIRMED')

    patchStoredBooking('b1', { depositResult: 'SUCCESS' })
    expect(getStoredBooking('b1')?.depositResult).toBe('SUCCESS')

    removeStoredBooking('b1')
    expect(listStoredBookings()).toHaveLength(0)
  })

  it('maps a payment reference back to its booking', () => {
    rememberPaymentRef('TXN-1', 'b1')
    expect(lookupPaymentRef('TXN-1')).toBe('b1')
    expect(lookupPaymentRef('nope')).toBeUndefined()
  })
})

const availableRooms: AvailableRoom[] = [
  { id: 'r1', roomTypeId: 'type1', roomTypeName: 'Deluxe', pricePerNight: 1_000_000, capacity: 3 },
  { id: 'r2', roomTypeId: 'type1', roomTypeName: 'Deluxe', pricePerNight: 1_000_000, capacity: 3 },
]

describe('SearchRoomsPage', () => {
  beforeEach(() => localStorage.clear())

  it('lists available rooms by type and lets the guest proceed', async () => {
    vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
      if (url === '/availability') return { data: availableRooms }
      throw new Error(`unexpected GET ${url}`)
    })

    renderWithAuth(bookingRoutes, {
      path: '/search?checkIn=2099-01-10&checkOut=2099-01-12&guests=2',
    })

    expect(await screen.findByRole('heading', { name: 'Deluxe' })).toBeInTheDocument()
    expect(screen.getByText('2 đêm · 2 phòng phù hợp')).toBeInTheDocument()

    // Chọn 1 phòng -> hiện thanh tiếp tục.
    fireEvent.change(screen.getByLabelText('Số phòng'), { target: { value: '1' } })
    expect(await screen.findByText(/Tiếp tục đặt phòng/)).toBeInTheDocument()
  })
})

describe('MyBookingsPage', () => {
  beforeEach(() => localStorage.clear())

  it('shows an empty state and then a stored booking', async () => {
    const empty = renderWithAuth(bookingRoutes, { path: '/my-bookings' })
    expect(screen.getByText(/Chưa có booking nào/)).toBeInTheDocument()
    empty.unmount()

    upsertStoredBooking(booking)
    renderWithAuth(bookingRoutes, { path: '/my-bookings' })
    expect(screen.getByText('BK123')).toBeInTheDocument()
    expect(screen.getByText('Chờ đặt cọc')).toBeInTheDocument()
  })
})
