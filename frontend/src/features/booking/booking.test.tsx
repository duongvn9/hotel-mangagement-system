import { fireEvent, screen, waitFor } from '@testing-library/react'
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
  adultCount: 2,
  childCount: 0,
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

const held = {
  bookingId: 'b9',
  holdToken: 'HOLDTOKEN123',
  status: 'ROOM_HELD',
  rooms: ['r1'],
  checkIn: '2099-01-10',
  checkOut: '2099-01-12',
  adultCount: 2,
  childCount: 0,
  roomTotal: 2_000_000,
  depositAmount: 600_000,
  holdExpiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
}

describe('CreateBookingPage (hold-first flow)', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => vi.restoreAllMocks())

  it('holds a room on entry and submits contact details before paying', async () => {
    const post = vi.spyOn(api, 'post').mockImplementation(async (url: string) => {
      if (url === '/bookings/hold') return { data: held }
      if (url === '/bookings/details') return { data: { ...held, status: 'PENDING_DEPOSIT' } }
      throw new Error(`unexpected POST ${url}`)
    })
    vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
      if (url === '/bookings/b9')
        return { data: { ...booking, id: 'b9', status: 'PENDING_DEPOSIT' } }
      throw new Error(`unexpected GET ${url}`)
    })

    const { router } = renderWithAuth(bookingRoutes, {
      path: '/booking/new?checkIn=2099-01-10&checkOut=2099-01-12&guests=2&rooms=r1',
    })

    // Hold được gọi ngay khi vào trang, trước khi nhập form; tạm tính lấy từ server.
    expect(await screen.findByRole('button', { name: 'Tiếp tục đặt cọc' })).toBeInTheDocument()
    expect(post).toHaveBeenCalledWith(
      '/bookings/hold',
      expect.objectContaining({ rooms: ['r1'], adultCount: 2 }),
    )

    fireEvent.change(screen.getByLabelText('Họ tên', { exact: false }), {
      target: { value: 'Nguyen Van A' },
    })
    fireEvent.change(screen.getByLabelText('Email', { exact: false }), {
      target: { value: 'a@example.com' },
    })
    fireEvent.change(screen.getByLabelText('Số điện thoại', { exact: false }), {
      target: { value: '0900000000' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục đặt cọc' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/booking/b9'))
    expect(post).toHaveBeenCalledWith(
      '/bookings/details',
      expect.objectContaining({ holdToken: 'HOLDTOKEN123', guestName: 'Nguyen Van A' }),
    )
  })
})

describe('BookingDetailPage (server-authoritative)', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => vi.restoreAllMocks())

  it('reads authoritative booking state and starts a VNPay deposit', async () => {
    vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
      if (url === '/bookings/b1') return { data: booking }
      throw new Error(`unexpected GET ${url}`)
    })
    const post = vi.spyOn(api, 'post').mockResolvedValue({
      data: { transactionRef: 'TXN9', paymentUrl: 'https://vnpay.test/pay', amount: 600_000 },
    })

    renderWithAuth(bookingRoutes, { path: '/booking/b1' })

    expect(await screen.findByText('BK123')).toBeInTheDocument()
    expect(screen.getByText('Chờ đặt cọc')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Đặt cọc qua VNPay' }))
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        '/payments/deposit',
        expect.objectContaining({ bookingId: 'b1' }),
      ),
    )
  })

  it('shows the expired state and hides the deposit action', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({
      data: { ...booking, id: 'b2', code: 'BK999', status: 'EXPIRED', holdExpiresAt: undefined },
    })

    renderWithAuth(bookingRoutes, { path: '/booking/b2' })

    expect(await screen.findByText('Hết hạn giữ phòng')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Đặt cọc qua VNPay' }),
    ).not.toBeInTheDocument()
  })
})
