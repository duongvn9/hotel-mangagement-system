import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { addDays, format } from 'date-fns'
import { AuthContext, type AuthContextValue } from '@/features/auth/auth-context'
import { api } from '@/lib/api-client'
import { ME, renderWithAuth } from '@/features/auth/test-utils'
import { bookingRoutes } from './routes'
import type { AvailableRoom, Booking, BookingSummary } from './api'
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

const booking: Booking = {
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
  source: 'ONLINE',
  holdExpiresAt: '2099-01-10T00:00:00.000Z',
}

/** Chi tiết mà trang booking đọc từ /bookings/:id/summary, dựng từ một booking mẫu. */
const summaryFor = (value: Booking, overrides: Partial<BookingSummary> = {}): BookingSummary => ({
  bookingId: value.id,
  code: value.code,
  status: value.status,
  source: value.source,
  checkIn: value.checkIn,
  checkOut: value.checkOut,
  adultCount: value.adultCount,
  childCount: value.childCount,
  createdAt: '2099-01-01T00:00:00.000Z',
  depositAmount: value.depositAmount,
  guest: { name: 'Khách Test', email: 'k@example.test', phone: '0900000001' },
  rooms: [{ roomNumber: '101', roomTypeName: 'Deluxe' }],
  invoice: {
    roomTotal: value.roomTotal,
    serviceTotal: 0,
    additionalTotal: 0,
    discountTotal: 0,
    taxTotal: 0,
    totalAmount: value.roomTotal,
    depositPaid: 0,
    finalPaid: 0,
    balanceDue: value.roomTotal,
  },
  payments: [],
  serviceOrders: [],
  ...overrides,
})

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

  it.each(['/search', '/search?checkIn=2099-01-10&checkOut=2099-01-12&guests=2'])(
    'shows actual bed configuration without advanced occupancy controls at %s',
    async (path) => {
      const beds = [
        { bedTypeId: 'bed-1', bedTypeName: 'Giường đôi cập nhật', quantity: 1 },
        { bedTypeId: 'bed-2', bedTypeName: 'Giường đơn bổ sung', quantity: 2 },
      ]
      vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
        if (url === '/availability/filters')
          return { data: { bedTypes: [], amenities: [], priceRange: { min: 0, max: 0 } } }
        if (url === '/availability')
          return { data: [{ ...availableRooms[0], roomTypeName: 'Standard', beds }] }
        throw new Error(`unexpected GET ${url}`)
      })
      renderWithAuth(bookingRoutes, { path })
      await screen.findByRole('heading', { name: 'Standard' })
      expect(screen.getByText('1 Giường đôi cập nhật, 2 Giường đơn bổ sung')).toBeInTheDocument()
      expect(screen.queryByText('2 giường đơn')).not.toBeInTheDocument()
      expect(screen.queryByText('Sức chứa')).not.toBeInTheDocument()
      expect(screen.queryByRole('group', { name: 'Người lớn' })).not.toBeInTheDocument()
      expect(screen.queryByRole('group', { name: 'Trẻ em' })).not.toBeInTheDocument()
      const search = screen.getByRole('search', { name: 'Tìm phòng trống' })
      expect(within(search).getByRole('combobox')).toHaveTextContent('2 khách')
    },
  )

  it.each([
    ['/search', undefined],
    ['/search', []],
    ['/search?checkIn=2099-01-10&checkOut=2099-01-12&guests=2', undefined],
    ['/search?checkIn=2099-01-10&checkOut=2099-01-12&guests=2', []],
  ])('hides missing or empty bed metadata at %s (%s)', async (path, beds) => {
    vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
      if (url === '/availability/filters')
        return { data: { bedTypes: [], amenities: [], priceRange: { min: 0, max: 0 } } }
      if (url === '/availability')
        return { data: [{ ...availableRooms[0], roomTypeName: 'Standard', beds }] }
      throw new Error(`unexpected GET ${url}`)
    })
    const { container } = renderWithAuth(bookingRoutes, { path })
    await screen.findByRole('heading', { name: 'Standard' })
    expect(screen.queryByText('2 giường đơn')).not.toBeInTheDocument()
    expect(container.querySelector('.lucide-bed-double.size-3\\.5')).not.toBeInTheDocument()
    expect(screen.getByText('Tối đa 3')).toBeInTheDocument()
  })

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

    // Tăng số phòng bằng stepper -> hiện thanh tiếp tục.
    fireEvent.click(screen.getByRole('button', { name: /Thêm phòng/ }))
    expect(await screen.findByText(/Tiếp tục đặt phòng/)).toBeInTheDocument()
    const total = screen.getByText(/^Tạm tính/)
    expect(total).not.toHaveClass('font-display')
    expect(total).toHaveClass('tabular-nums', 'tracking-tight')
    expect(total).toHaveTextContent('2.000.000')
  })

  it('lets the guest pick several rooms of one type and caps at what is free', async () => {
    vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
      if (url === '/availability') return { data: availableRooms }
      throw new Error(`unexpected GET ${url}`)
    })
    renderWithAuth(bookingRoutes, {
      path: '/search?checkIn=2099-01-10&checkOut=2099-01-12&guests=2',
    })

    await screen.findByRole('heading', { name: 'Deluxe' })
    const add = screen.getByRole('button', { name: /Thêm phòng/ })
    fireEvent.click(add)
    fireEvent.click(add)
    expect(await screen.findByText(/Đã chọn 2 phòng/)).toBeInTheDocument()
    // Chỉ còn 2 phòng trống nên không thể tăng thêm.
    expect(add).toBeDisabled()
  })

  it('warns softly when the chosen rooms hold fewer guests than requested', async () => {
    vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
      if (url === '/availability') return { data: availableRooms }
      throw new Error(`unexpected GET ${url}`)
    })
    renderWithAuth(bookingRoutes, {
      path: '/search?checkIn=2099-01-10&checkOut=2099-01-12&guests=4',
    })

    await screen.findByRole('heading', { name: 'Deluxe' })
    fireEvent.click(screen.getByRole('button', { name: /Thêm phòng/ }))
    expect(await screen.findByText(/nhỏ hơn số khách/)).toBeInTheDocument()
  })

  it('filters initial availability by bed type and shows the bed configuration', async () => {
    const typesWithBeds = [
      {
        id: 'type-std',
        name: 'Standard',
        description: '',
        adultCapacity: 2,
        childCapacity: 1,
        capacity: 3,
        pricePerNight: 850_000,
        images: [],
        beds: [{ bedTypeId: 'bed-1', bedTypeName: 'Giường đôi', quantity: 1 }],
      },
    ]
    const get = vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
      if (url === '/availability/filters')
        return {
          data: {
            bedTypes: [{ id: 'bed-1', name: 'Giường đôi' }],
            amenities: [{ id: 'am-1', name: 'Wi-Fi' }],
            priceRange: { min: 850_000, max: 850_000 },
          },
        }
      if (url === '/availability')
        return {
          data: typesWithBeds.map((type) => ({
            ...availableRooms[0],
            roomTypeName: type.name,
            beds: type.beds,
          })),
        }
      throw new Error(`unexpected GET ${url}`)
    })
    renderWithAuth(bookingRoutes, { path: '/search' })
    await screen.findByRole('heading', { name: 'Standard' })
    expect(screen.getByText('1 Giường đôi')).toBeInTheDocument()
    fireEvent.click(await screen.findByRole('button', { name: 'Giường đôi' }))
    await waitFor(() =>
      expect(get).toHaveBeenCalledWith('/availability', {
        params: expect.objectContaining({ bedTypeIds: 'bed-1' }),
      }),
    )
  })

  it('filters availability by an amenity chip', async () => {
    const get = vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
      if (url === '/availability/filters')
        return {
          data: {
            bedTypes: [],
            amenities: [{ id: 'am-1', name: 'Wi-Fi' }],
            priceRange: { min: 0, max: 0 },
          },
        }
      if (url === '/availability') return { data: availableRooms }
      throw new Error(`unexpected GET ${url}`)
    })
    renderWithAuth(bookingRoutes, {
      path: '/search?checkIn=2099-01-10&checkOut=2099-01-12&guests=2',
    })
    await screen.findByRole('heading', { name: 'Deluxe' })
    fireEvent.click(await screen.findByRole('button', { name: 'Wi-Fi' }))
    await waitFor(() =>
      expect(get).toHaveBeenCalledWith('/availability', {
        params: expect.objectContaining({ amenityIds: 'am-1' }),
      }),
    )
  })

  describe('initial search with default dates', () => {
    const roomTypes = [
      {
        id: 'type-std',
        name: 'Standard',
        description: '',
        adultCapacity: 2,
        childCapacity: 1,
        capacity: 3,
        pricePerNight: 850_000,
        images: ['/images/seeds/room-types/standard-01.jpg'],
      },
      {
        id: 'type-suite',
        name: 'Suite',
        description: '',
        adultCapacity: 2,
        childCapacity: 2,
        capacity: 4,
        pricePerNight: 4_500_000,
        images: [],
      },
    ]
    const mockInitialAvailability = (types = roomTypes) =>
      vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
        if (url === '/availability')
          return {
            data: types.map((type) => ({
              ...availableRooms[0],
              id: `room-${type.id}`,
              roomTypeId: type.id,
              roomTypeName: type.name,
              pricePerNight: type.pricePerNight,
            })),
          }
        throw new Error(`unexpected GET ${url}`)
      })

    it('searches availability with the dates shown in the search bar on initial opening', async () => {
      const get = vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
        if (url === '/availability')
          return { data: [{ ...availableRooms[0], roomTypeName: 'Standard' }] }
        throw new Error(`unexpected GET ${url}`)
      })
      renderWithAuth(bookingRoutes, { path: '/search' })

      expect(await screen.findByRole('heading', { name: 'Standard' })).toBeInTheDocument()
      expect(get).not.toHaveBeenCalledWith('/availability/room-types', expect.anything())
      const detail = screen.getByRole('link', { name: 'Chi tiết' })
      const dates = new URL(detail.getAttribute('href')!, 'http://localhost').searchParams
      expect(dates.get('checkIn')).toBe(format(addDays(new Date(), 3), 'yyyy-MM-dd'))
      expect(dates.get('checkOut')).toBe(format(addDays(new Date(), 6), 'yyyy-MM-dd'))
      expect(dates.get('guests')).toBe('2')
      expect(screen.getByText(/1 phòng phù hợp/)).toBeInTheDocument()
      expect(get).toHaveBeenCalledWith('/availability', {
        params: expect.objectContaining({
          checkIn: dates.get('checkIn'),
          checkOut: dates.get('checkOut'),
          guests: 2,
        }),
      })
      expect(screen.getByRole('button', { name: /Nhận phòng/ })).toHaveTextContent(
        new Date(`${dates.get('checkIn')}T12:00:00`).getDate().toString(),
      )
      expect(screen.queryByRole('link', { name: 'Xem phòng trống' })).not.toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'Thêm phòng Standard' }))
      expect(screen.getByRole('button', { name: 'Tiếp tục đặt phòng' })).toBeInTheDocument()
      expect(detail).toHaveAttribute('href', expect.stringContaining('/room-types/type1'))
    })

    it('applies the dates the guest picked through the search bar, not the default ones', async () => {
      const get = mockInitialAvailability()
      renderWithAuth(bookingRoutes, { path: '/search' })
      await screen.findByRole('heading', { name: 'Standard' })

      // Tháng sau tháng hiện tại luôn nằm trong lịch hai tháng.
      const target = new Date()
      target.setDate(1)
      target.setMonth(target.getMonth() + 1)
      const monthNumber = target.getMonth() + 1
      const dayButton = async (n: number) =>
        (
          await screen.findAllByRole('button', {
            name: new RegExp(`\\b${n} tháng ${monthNumber}\\b`),
          })
        )[0]

      fireEvent.click(screen.getByRole('button', { name: /Nhận phòng/ }))
      fireEvent.click(await dayButton(20))
      fireEvent.click(await dayButton(23))

      const month = String(monthNumber).padStart(2, '0')
      const year = target.getFullYear()
      const expected = `checkIn=${year}-${month}-20&checkOut=${year}-${month}-23`
      expect(screen.getAllByRole('link', { name: 'Chi tiết' })[0]).not.toHaveAttribute(
        'href',
        expect.stringContaining(expected),
      )
      fireEvent.click(screen.getByRole('button', { name: /Kiểm tra phòng trống/ }))
      await waitFor(() =>
        expect(get).toHaveBeenCalledWith('/availability', {
          params: expect.objectContaining({
            checkIn: `${year}-${month}-20`,
            checkOut: `${year}-${month}-23`,
          }),
        }),
      )
      expect((await screen.findAllByRole('link', { name: 'Chi tiết' }))[0]).toHaveAttribute(
        'href',
        expect.stringContaining(expected),
      )
    })

    it('lists the cheapest room type first', async () => {
      mockInitialAvailability()
      renderWithAuth(bookingRoutes, { path: '/search' })
      await screen.findByRole('heading', { name: 'Standard' })

      const names = screen
        .getAllByRole('heading')
        .map((heading) => heading.textContent)
        .filter((name) => name === 'Standard' || name === 'Suite')
      expect(names).toEqual(['Standard', 'Suite'])
    })

    it('preserves valid URL dates rather than replacing them with defaults', async () => {
      const get = mockInitialAvailability()
      renderWithAuth(bookingRoutes, {
        path: '/search?checkIn=2099-01-10&checkOut=2099-01-12&guests=3',
      })
      await screen.findByRole('heading', { name: 'Standard' })
      expect(get).toHaveBeenCalledWith('/availability', {
        params: { checkIn: '2099-01-10', checkOut: '2099-01-12', guests: 3 },
      })
      expect(screen.getByRole('combobox')).toHaveTextContent('3 khách')
      expect(screen.getAllByRole('link', { name: 'Chi tiết' })[0]).toHaveAttribute(
        'href',
        '/room-types/type-std?checkIn=2099-01-10&checkOut=2099-01-12&guests=3',
      )
    })

    it('says so when no room is available for the default dates', async () => {
      mockInitialAvailability([])
      renderWithAuth(bookingRoutes, { path: '/search' })
      expect(await screen.findByText('Không có phòng phù hợp')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /Thêm phòng/ })).not.toBeInTheDocument()
    })

    it('shows an error when initial availability cannot be loaded', async () => {
      vi.spyOn(api, 'get').mockRejectedValue(new Error('Máy chủ bận'))
      renderWithAuth(bookingRoutes, { path: '/search' })
      expect(await screen.findByRole('alert')).toHaveTextContent(/Có lỗi xảy ra|Máy chủ bận/)
    })
  })

  it('shows empty message when no rooms match', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({ data: [] })
    renderWithAuth(bookingRoutes, {
      path: '/search?checkIn=2099-01-10&checkOut=2099-01-12&guests=2',
    })
    expect(await screen.findByText(/Không có phòng phù hợp/i)).toBeInTheDocument()
  })

  it('shows error alert when availability query fails', async () => {
    vi.spyOn(api, 'get').mockRejectedValue(new Error('Máy chủ bận'))
    renderWithAuth(bookingRoutes, {
      path: '/search?checkIn=2099-01-10&checkOut=2099-01-12&guests=2',
    })
    expect(await screen.findByRole('alert')).toHaveTextContent(/Có lỗi xảy ra|Máy chủ bận/)
  })
})

describe('RoomDetailsPage', () => {
  beforeEach(() => localStorage.clear())

  const mockRoom = {
    id: 't1',
    name: 'Phòng Biển Deluxe',
    description: 'Tầm nhìn tuyệt đẹp hướng biển Đông.',
    adultCapacity: 2,
    childCapacity: 1,
    capacity: 3,
    pricePerNight: 1800000,
    images: ['room1.jpg', 'room2.jpg'],
    amenities: [
      { id: 'a1', name: 'Ban công ngắm biển' },
      { id: 'a2', name: 'Bồn tắm nằm' },
    ],
  }

  it('renders room details including name, description, amenities, and price', async () => {
    vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
      if (url === '/room-types/t1/overview') return { data: mockRoom }
      throw new Error(`unexpected GET ${url}`)
    })

    renderWithAuth(bookingRoutes, { path: '/room-types/t1' })

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Phòng Biển Deluxe' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Tầm nhìn tuyệt đẹp hướng biển Đông.')).toBeInTheDocument()
    expect(screen.getByText('Ban công ngắm biển')).toBeInTheDocument()
    expect(screen.getByText('Bồn tắm nằm')).toBeInTheDocument()
    expect(screen.getByText(/1\.800\.000/)).toBeInTheDocument()
  })

  it('books now straight from the detail page using a free room of the type', async () => {
    vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
      if (url === '/room-types/t1/overview') return { data: mockRoom }
      if (url === '/availability')
        return {
          data: [
            {
              id: 'r5',
              roomTypeId: 't1',
              roomTypeName: 'Phòng Biển Deluxe',
              pricePerNight: 1_800_000,
              capacity: 3,
            },
          ],
        }
      throw new Error(`unexpected GET ${url}`)
    })

    renderWithAuth(bookingRoutes, {
      path: '/room-types/t1?checkIn=2099-01-10&checkOut=2099-01-12&guests=2',
    })

    const cta = await screen.findByRole('link', { name: 'Đặt ngay' })
    expect(cta).toHaveAttribute(
      'href',
      '/booking/new?checkIn=2099-01-10&checkOut=2099-01-12&guests=2&rooms=r5',
    )
  })

  it('shows the room bed configuration', async () => {
    vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
      if (url === '/room-types/t1/overview')
        return {
          data: {
            ...mockRoom,
            beds: [{ bedTypeId: 'bed-1', bedTypeName: 'Giường đôi', quantity: 1 }],
          },
        }
      throw new Error(`unexpected GET ${url}`)
    })
    renderWithAuth(bookingRoutes, { path: '/room-types/t1' })
    await screen.findByRole('heading', { level: 1, name: 'Phòng Biển Deluxe' })
    expect(screen.getByRole('heading', { name: 'Cấu hình giường' })).toBeInTheDocument()
    expect(screen.getByText('1 Giường đôi')).toBeInTheDocument()
  })
})

describe('MyBookingsPage', () => {
  afterEach(() => vi.restoreAllMocks())

  const customer = {
    me: {
      id: 'c1',
      email: 'khach@hms.local',
      fullName: 'Nguyễn Văn Khách',
      role: 'CUSTOMER',
      permissions: [],
    },
  }

  const myItem = (over: Record<string, unknown>) => ({
    id: 'x',
    code: 'BK',
    status: 'CONFIRMED',
    checkIn: '2099-01-01',
    checkOut: '2099-01-02',
    adultCount: 1,
    childCount: 0,
    roomCount: 1,
    roomTotal: 1_000_000,
    depositAmount: 100_000,
    createdAt: '2099-01-01T00:00:00.000Z',
    ...over,
  })

  it('requires login and lists the customer bookings from the server', async () => {
    const get = vi.spyOn(api, 'get').mockResolvedValue({ data: [] })
    const empty = renderWithAuth(bookingRoutes, { path: '/my-bookings', auth: customer })
    expect(await screen.findByText(/Bạn chưa có đặt phòng nào/)).toBeInTheDocument()
    empty.unmount()

    get.mockResolvedValue({
      data: [
        {
          id: 'b1',
          code: 'BK123',
          status: 'PENDING_DEPOSIT',
          checkIn: '2099-01-10',
          checkOut: '2099-01-12',
          adultCount: 2,
          childCount: 0,
          roomCount: 1,
          roomTotal: 2_000_000,
          depositAmount: 200_000,
          createdAt: '2099-01-01T00:00:00.000Z',
        },
      ],
    })
    renderWithAuth(bookingRoutes, { path: '/my-bookings', auth: customer })
    expect(await screen.findByText('BK123')).toBeInTheDocument()
    expect(screen.getByText('Chờ đặt cọc')).toBeInTheDocument()
  })

  it('shows each booking as a card with the room photo, room type, code, total and amount paid', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({
      data: [
        myItem({
          id: 'b1',
          code: 'BK2401',
          status: 'CHECKED_IN',
          checkIn: '2099-03-10',
          checkOut: '2099-03-11',
          adultCount: 1,
          roomTotal: 1_250_000,
          paidAmount: 375_000,
          roomTypeName: 'Phòng Đôi Hướng Vườn',
          roomTypeImage: '/images/seeds/room-types/standard-01.jpg',
          roomNumber: '101',
        }),
      ],
    })
    renderWithAuth(bookingRoutes, { path: '/my-bookings', auth: customer })

    const card = (await screen.findByText('Phòng Đôi Hướng Vườn')).closest('a') as HTMLElement
    expect(card).toHaveAttribute('href', '/my-bookings/b1')
    expect(within(card).getByText('Đã nhận phòng')).toBeInTheDocument()
    expect(within(card).getByText('BK2401')).toBeInTheDocument()
    expect(card).toHaveTextContent('BK2401 · Phòng 101 · 1 khách')
    expect(within(card).getByText(/→/)).toHaveTextContent('→')
    expect(within(card).getByText('1.250.000 ₫')).toBeInTheDocument()
    expect(within(card).getByText('Đã trả 375.000 ₫')).toBeInTheDocument()
    expect(card.querySelector('img')).toHaveAttribute(
      'src',
      expect.stringContaining('standard-01.jpg'),
    )
  })

  it('still shows a card for a booking without room details or payments', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({
      data: [myItem({ id: 'b9', code: 'BK-PLAIN', roomCount: 2, adultCount: 2, childCount: 1 })],
    })
    renderWithAuth(bookingRoutes, { path: '/my-bookings', auth: customer })

    const card = (await screen.findByText('BK-PLAIN')).closest('a') as HTMLElement
    expect(card).toHaveTextContent('BK-PLAIN · 2 phòng · 3 khách')
    expect(within(card).getByText('Đã trả 0 ₫')).toBeInTheDocument()
    expect(within(card).getByText('Đặt phòng')).toBeInTheDocument()
  })

  it('sorts bookings by check-in date, newest first by default', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({
      data: [
        myItem({ id: 'b1', code: 'BK-A', checkIn: '2099-03-10' }),
        myItem({ id: 'b2', code: 'BK-B', checkIn: '2099-05-10' }),
        myItem({ id: 'b3', code: 'BK-C', checkIn: '2099-01-10' }),
      ],
    })
    renderWithAuth(bookingRoutes, { path: '/my-bookings', auth: customer })
    await screen.findByText('BK-A')
    const codes = screen.getAllByText(/^BK-[A-C]$/).map((el) => el.textContent)
    expect(codes).toEqual(['BK-B', 'BK-A', 'BK-C'])
  })

  it('can sort bookings by check-in date oldest first', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({
      data: [
        myItem({ id: 'b1', code: 'BK-A', checkIn: '2099-03-10' }),
        myItem({ id: 'b2', code: 'BK-B', checkIn: '2099-05-10' }),
        myItem({ id: 'b3', code: 'BK-C', checkIn: '2099-01-10' }),
      ],
    })
    renderWithAuth(bookingRoutes, { path: '/my-bookings', auth: customer })
    await screen.findByText('BK-A')
    fireEvent.change(screen.getByLabelText('Sắp xếp'), { target: { value: 'checkin-asc' } })
    const codes = screen.getAllByText(/^BK-[A-C]$/).map((el) => el.textContent)
    expect(codes).toEqual(['BK-C', 'BK-A', 'BK-B'])
  })

  it('filters bookings by status', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({
      data: [
        myItem({ id: 'b1', code: 'BK-A', checkIn: '2099-03-10', status: 'CHECKED_OUT' }),
        myItem({ id: 'b2', code: 'BK-B', checkIn: '2099-05-10', status: 'PENDING_DEPOSIT' }),
      ],
    })
    renderWithAuth(bookingRoutes, { path: '/my-bookings', auth: customer })
    await screen.findByText('BK-A')
    fireEvent.change(screen.getByLabelText('Trạng thái'), { target: { value: 'CHECKED_OUT' } })
    expect(screen.getByText('BK-A')).toBeInTheDocument()
    expect(screen.queryByText('BK-B')).not.toBeInTheDocument()
  })

  it('filters bookings by check-in date range', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({
      data: [
        myItem({ id: 'b1', code: 'BK-A', checkIn: '2099-03-10' }),
        myItem({ id: 'b2', code: 'BK-B', checkIn: '2099-05-10' }),
        myItem({ id: 'b3', code: 'BK-C', checkIn: '2099-01-10' }),
      ],
    })
    renderWithAuth(bookingRoutes, { path: '/my-bookings', auth: customer })
    await screen.findByText('BK-A')
    fireEvent.change(screen.getByLabelText('Nhận phòng từ'), { target: { value: '2099-02-01' } })
    fireEvent.change(screen.getByLabelText('Nhận phòng đến'), { target: { value: '2099-04-01' } })
    expect(screen.getByText('BK-A')).toBeInTheDocument()
    expect(screen.queryByText('BK-B')).not.toBeInTheDocument()
    expect(screen.queryByText('BK-C')).not.toBeInTheDocument()
  })

  it('paginates bookings with 8 per page', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({
      data: Array.from({ length: 10 }, (_, i) =>
        myItem({
          id: `b${i}`,
          code: `BK-${i}`,
          checkIn: `2099-01-${String(i + 1).padStart(2, '0')}`,
        }),
      ),
    })
    renderWithAuth(bookingRoutes, { path: '/my-bookings', auth: customer })
    // Mỗi card có một dòng "Đã trả …".
    await screen.findAllByText(/^Đã trả \d/)
    expect(screen.getAllByText(/^Đã trả \d/)).toHaveLength(8)
    fireEvent.click(screen.getByLabelText('Trang sau'))
    expect(screen.getAllByText(/^Đã trả \d/)).toHaveLength(2)
  })
})

const held = {
  bookingId: 'b9',
  code: 'BK900',
  holdToken: 'HOLDTOKEN123',
  status: 'ROOM_HELD',
  rooms: ['r1'],
  roomTypes: [
    { roomTypeId: 'type1', roomTypeName: 'Deluxe', pricePerNight: 1_000_000, roomIds: ['r1'] },
  ],
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

  it.each(['anonymous', 'authenticated'] as const)(
    'waits for auth restoration before holding a room as %s',
    async (status) => {
      const post = vi.spyOn(api, 'post').mockResolvedValue({ data: held })
      vi.spyOn(api, 'get').mockResolvedValue({ data: { items: [] } })
      const router = createMemoryRouter(bookingRoutes, {
        initialEntries: ['/booking/new?checkIn=2099-01-10&checkOut=2099-01-12&guests=2&rooms=r1'],
      })
      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
      const auth: AuthContextValue = {
        me: null,
        status: 'loading',
        isDevMode: false,
        login: vi.fn(),
        loginAsDev: vi.fn(),
        loginWithGoogle: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
        refresh: vi.fn(),
      }
      const view = (value: AuthContextValue) => (
        <QueryClientProvider client={queryClient}>
          <AuthContext value={value}>
            <RouterProvider router={router} />
          </AuthContext>
        </QueryClientProvider>
      )
      const { rerender } = render(view(auth))
      await screen.findByRole('heading', { name: 'Xác nhận & thông tin liên hệ' })
      expect(post).not.toHaveBeenCalled()

      rerender(
        view({
          ...auth,
          status,
          me: status === 'authenticated' ? { ...ME, role: 'CUSTOMER' } : null,
        }),
      )
      await screen.findByRole('button', { name: 'Tiếp tục đặt cọc' })
      expect(post).toHaveBeenCalledExactlyOnceWith('/bookings/hold', {
        rooms: ['r1'],
        checkIn: '2099-01-10',
        checkOut: '2099-01-12',
        adultCount: 2,
        childCount: 0,
      })
    },
  )

  it('holds a room on entry and submits contact details before paying', async () => {
    const post = vi.spyOn(api, 'post').mockImplementation(async (url: string) => {
      if (url === '/bookings/hold') return { data: held }
      if (url === '/bookings/details') return { data: { ...held, status: 'PENDING_DEPOSIT' } }
      if (url === '/payments/deposit')
        return {
          data: {
            transactionRef: 'TXN-CHECKOUT',
            paymentUrl: 'https://vnpay.test/pay',
            amount: 600_000,
          },
        }
      throw new Error(`unexpected POST ${url}`)
    })
    vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
      if (url === '/bookings/service-catalog') return { data: { items: [] } }
      if (url === '/availability') return { data: [] }
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

    expect(await screen.findByRole('heading', { name: 'Thanh toán cọc' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/booking/new')
    expect(post).toHaveBeenCalledWith(
      '/bookings/details',
      expect.objectContaining({ holdToken: 'HOLDTOKEN123', guestName: 'Nguyen Van A' }),
    )
  })

  it.each(['GUEST', 'CUSTOMER', 'MANAGER'])(
    'keeps %s checkout in-page and retries VNPay without resubmitting contact details',
    async (role) => {
      const post = vi.spyOn(api, 'post').mockImplementation(async (url: string) => {
        if (url === '/bookings/hold') return { data: held }
        if (url === '/bookings/details')
          return { data: { ...held, status: 'PENDING_DEPOSIT', depositAmount: 200_000 } }
        if (url === '/payments/deposit') {
          if (post.mock.calls.filter(([path]) => path === '/payments/deposit').length === 1)
            throw new Error('VNPay đang bận')
          return {
            data: {
              transactionRef: 'TXN-CHECKOUT',
              paymentUrl: '#vnpay-checkout',
              amount: 200_000,
            },
          }
        }
        throw new Error(`unexpected POST ${url}`)
      })
      vi.spyOn(api, 'get').mockResolvedValue({ data: { items: [] } })
      const { router, unmount } = renderWithAuth(bookingRoutes, {
        path: '/booking/new?checkIn=2099-01-10&checkOut=2099-01-12&guests=2&rooms=r1',
        auth: role === 'GUEST' ? {} : { me: { ...ME, role }, status: 'authenticated' },
      })
      await screen.findByRole('button', { name: 'Tiếp tục đặt cọc' })
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

      await screen.findByRole('heading', { name: 'Thanh toán cọc' })
      expect(router.state.location.pathname).toBe('/booking/new')
      expect(screen.getByText('BK900')).toBeInTheDocument()
      expect(screen.getByRole('radio', { name: /VNPay/ })).toBeChecked()
      expect(screen.queryByLabelText('Họ tên', { exact: false })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Huỷ giữ phòng' })).not.toBeInTheDocument()
      expect(screen.queryByText(/Thẻ quốc tế|Mô phỏng|30%/)).not.toBeInTheDocument()
      const pay = screen.getByRole('button', { name: 'Thanh toán 200.000 ₫' })
      fireEvent.click(pay)
      expect(await screen.findByRole('alert')).toHaveTextContent('Có lỗi xảy ra, vui lòng thử lại')
      expect(pay).not.toBeDisabled()
      fireEvent.click(pay)
      await waitFor(() =>
        expect(post.mock.calls.filter(([url]) => url === '/payments/deposit')).toHaveLength(2),
      )
      expect(post).toHaveBeenLastCalledWith('/payments/deposit', {
        bookingId: 'b9',
        ...(role === 'GUEST' ? { code: 'BK900' } : {}),
      })
      await waitFor(() => expect(lookupPaymentRef('TXN-CHECKOUT')).toBe('b9'))
      expect(window.location.hash).toBe('#vnpay-checkout')
      window.history.replaceState({}, '', '/')
      expect(post.mock.calls.filter(([url]) => url === '/bookings/details')).toHaveLength(1)
      expect(post.mock.calls.filter(([url]) => url === '/bookings/hold')).toHaveLength(1)
      unmount()
      expect(post.mock.calls.some(([url]) => url === '/bookings/b9/cancel')).toBe(false)
    },
  )

  it.each([false, true])(
    'resumes pending deposit without contact resubmission (expired: %s)',
    async (expired) => {
      const post = vi.spyOn(api, 'post').mockResolvedValue({
        data: {
          ...held,
          status: 'PENDING_DEPOSIT',
          depositAmount: 200_000,
          holdExpiresAt: new Date(Date.now() + (expired ? -1000 : 60_000)).toISOString(),
        },
      })
      vi.spyOn(api, 'get').mockResolvedValue({ data: { items: [] } })
      const { unmount } = renderWithAuth(bookingRoutes, {
        path: '/booking/new?checkIn=2099-01-10&checkOut=2099-01-12&guests=2&rooms=r1',
      })
      await screen.findByRole('heading', { name: 'Thanh toán cọc' })
      const pay = screen.getByRole('button', { name: 'Thanh toán 200.000 ₫' })
      if (expired) expect(pay).toBeDisabled()
      else expect(pay).not.toBeDisabled()
      if (expired) expect(screen.getByText('Hết hạn giữ phòng')).toBeInTheDocument()
      else expect(screen.getByText(/Giữ phòng còn 0:/)).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Tiếp tục đặt cọc' })).not.toBeInTheDocument()
      unmount()
      expect(post).toHaveBeenCalledTimes(1)
    },
  )

  it('lets the guest pick add-on services sent with the contact details', async () => {
    const post = vi.spyOn(api, 'post').mockImplementation(async (url: string) => {
      if (url === '/bookings/hold') return { data: held }
      if (url === '/bookings/details') return { data: { ...held, status: 'PENDING_DEPOSIT' } }
      if (url === '/payments/deposit')
        return {
          data: {
            transactionRef: 'TXN-CHECKOUT',
            paymentUrl: 'https://vnpay.test/pay',
            amount: 600_000,
          },
        }
      throw new Error(`unexpected POST ${url}`)
    })
    vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
      if (url === '/bookings/service-catalog')
        return {
          data: {
            items: [
              { id: 'svc1', name: 'Giặt ủi', unit: 'kg', billable: true, unitPriceVND: 50000 },
            ],
          },
        }
      if (url === '/availability') return { data: [] }
      if (url === '/bookings/b9')
        return { data: { ...booking, id: 'b9', status: 'PENDING_DEPOSIT' } }
      throw new Error(`unexpected GET ${url}`)
    })

    const { router } = renderWithAuth(bookingRoutes, {
      path: '/booking/new?checkIn=2099-01-10&checkOut=2099-01-12&guests=2&rooms=r1',
    })

    await screen.findByRole('button', { name: 'Tiếp tục đặt cọc' })
    // Chọn dịch vụ thêm (checkbox trong danh mục).
    fireEvent.click(await screen.findByRole('checkbox'))

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

    expect(await screen.findByRole('heading', { name: 'Thanh toán cọc' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/booking/new')
    expect(post).toHaveBeenCalledWith(
      '/bookings/details',
      expect.objectContaining({
        serviceSelections: [{ serviceId: 'svc1', quantity: 1 }],
      }),
    )
  })

  it('shows error alert when hold fails', async () => {
    vi.spyOn(api, 'post').mockRejectedValue(new Error('Hết phòng'))
    renderWithAuth(bookingRoutes, {
      path: '/booking/new?checkIn=2099-01-10&checkOut=2099-01-12&guests=2&rooms=r1',
    })
    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })

  it('shows expiration alert and disables submit when hold expires', async () => {
    vi.spyOn(api, 'post').mockResolvedValue({
      data: {
        ...held,
        holdExpiresAt: new Date(Date.now() - 1000).toISOString(),
      },
    })
    vi.spyOn(api, 'get').mockResolvedValue({ data: { items: [] } })

    renderWithAuth(bookingRoutes, {
      path: '/booking/new?checkIn=2099-01-10&checkOut=2099-01-12&guests=2&rooms=r1',
    })

    const button = await screen.findByRole('button', { name: 'Tiếp tục đặt cọc' })
    expect(button).toBeDisabled()
    expect(
      screen.getByText(/Đã quá thời gian giữ phòng|Thời gian giữ phòng đã hết/i),
    ).toBeInTheDocument()
  })

  it('lets the guest cancel the hold and returns to search', async () => {
    const post = vi.spyOn(api, 'post').mockImplementation(async (url: string) => {
      if (url === '/bookings/hold') return { data: held }
      if (url === '/bookings/b9/cancel')
        return { data: { id: 'b9', code: 'BK900', status: 'CANCELLED' } }
      throw new Error(`unexpected POST ${url}`)
    })
    vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
      if (url === '/bookings/service-catalog') return { data: { items: [] } }
      if (url === '/availability') return { data: [] }
      throw new Error(`unexpected GET ${url}`)
    })

    const { router } = renderWithAuth(bookingRoutes, {
      path: '/booking/new?checkIn=2099-01-10&checkOut=2099-01-12&guests=2&rooms=r1',
    })

    fireEvent.click(await screen.findByRole('button', { name: 'Huỷ giữ phòng' }))
    await waitFor(() => expect(post).toHaveBeenCalledWith('/bookings/b9/cancel', { code: 'BK900' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/search'))
  })

  it('releases the hold when the guest leaves before paying', async () => {
    const post = vi.spyOn(api, 'post').mockImplementation(async (url: string) => {
      if (url === '/bookings/hold') return { data: held }
      if (url === '/bookings/b9/cancel')
        return { data: { id: 'b9', code: 'BK900', status: 'CANCELLED' } }
      throw new Error(`unexpected POST ${url}`)
    })
    vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
      if (url === '/bookings/service-catalog') return { data: { items: [] } }
      if (url === '/availability') return { data: [] }
      throw new Error(`unexpected GET ${url}`)
    })

    const { unmount } = renderWithAuth(bookingRoutes, {
      path: '/booking/new?checkIn=2099-01-10&checkOut=2099-01-12&guests=2&rooms=r1',
    })

    await screen.findByRole('button', { name: 'Tiếp tục đặt cọc' })
    unmount()
    await waitFor(() => expect(post).toHaveBeenCalledWith('/bookings/b9/cancel', { code: 'BK900' }))
  })

  it('lets the guest adjust the room quantity on the booking page', async () => {
    const updated = {
      ...held,
      rooms: ['r1', 'r2'],
      roomTypes: [
        {
          roomTypeId: 'type1',
          roomTypeName: 'Deluxe',
          pricePerNight: 1_000_000,
          roomIds: ['r1', 'r2'],
        },
      ],
      roomTotal: 4_000_000,
      depositAmount: 400_000,
    }
    const post = vi.spyOn(api, 'post').mockImplementation(async (url: string) => {
      if (url === '/bookings/hold') return { data: held }
      if (url === '/bookings/hold/rooms') return { data: updated }
      throw new Error(`unexpected POST ${url}`)
    })
    vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
      if (url === '/bookings/service-catalog') return { data: { items: [] } }
      if (url === '/availability')
        return {
          data: [
            {
              id: 'r2',
              roomTypeId: 'type1',
              roomTypeName: 'Deluxe',
              pricePerNight: 1_000_000,
              capacity: 3,
            },
          ],
        }
      throw new Error(`unexpected GET ${url}`)
    })

    renderWithAuth(bookingRoutes, {
      path: '/booking/new?checkIn=2099-01-10&checkOut=2099-01-12&guests=2&rooms=r1',
    })

    // Tăng thêm 1 phòng trong bộ chỉnh số lượng rồi cập nhật -> gọi endpoint chỉnh hold.
    fireEvent.click(await screen.findByRole('button', { name: /Thêm phòng Deluxe/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Cập nhật số phòng' }))
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/bookings/hold/rooms', {
        holdToken: 'HOLDTOKEN123',
        rooms: ['r1', 'r2'],
      }),
    )
  })

  it('warns before leaving via in-app navigation and cancels the hold on confirm', async () => {
    const post = vi.spyOn(api, 'post').mockImplementation(async (url: string) => {
      if (url === '/bookings/hold') return { data: held }
      if (url === '/bookings/b9/cancel')
        return { data: { id: 'b9', code: 'BK900', status: 'CANCELLED' } }
      throw new Error(`unexpected POST ${url}`)
    })
    vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
      if (url === '/bookings/service-catalog') return { data: { items: [] } }
      if (url === '/availability') return { data: [] }
      throw new Error(`unexpected GET ${url}`)
    })

    const { router } = renderWithAuth(bookingRoutes, {
      path: '/booking/new?checkIn=2099-01-10&checkOut=2099-01-12&guests=2&rooms=r1',
    })

    // Đang giữ phòng, bấm "Chọn lại phòng" (điều hướng nội bộ) -> hiện cảnh báo rời trang.
    fireEvent.click(await screen.findByRole('link', { name: /Chọn lại phòng/ }))
    expect(await screen.findByRole('alertdialog')).toHaveTextContent(/Rời trang khi đang giữ phòng/)

    // Xác nhận rời -> huỷ giữ phòng rồi điều hướng tiếp.
    fireEvent.click(screen.getByRole('button', { name: /Rời .* huỷ giữ phòng/ }))
    await waitFor(() => expect(post).toHaveBeenCalledWith('/bookings/b9/cancel', { code: 'BK900' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/search'))
  })
})

describe('BookingDetailPage (server-authoritative)', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => vi.restoreAllMocks())

  it('reads authoritative booking state and starts a VNPay deposit', async () => {
    vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
      if (url === '/bookings/b1') return { data: booking }
      if (url === '/bookings/b1/summary') return { data: summaryFor(booking) }
      throw new Error(`unexpected GET ${url}`)
    })
    const post = vi.spyOn(api, 'post').mockResolvedValue({
      data: { transactionRef: 'TXN9', paymentUrl: 'https://vnpay.test/pay', amount: 600_000 },
    })

    renderWithAuth(bookingRoutes, { path: '/booking/b1' })

    expect(await screen.findByText('BK123')).toBeInTheDocument()
    expect(screen.getByText('Chờ đặt cọc')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Đặt cọc qua VNPay/ }))
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        '/payments/deposit',
        expect.objectContaining({ bookingId: 'b1' }),
      ),
    )
  })

  it.each(['RECEPTIONIST', 'MANAGER'])(
    'sends %s to the staff booking page inside the dashboard',
    async (role) => {
      vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
        if (url === '/bookings/b1') return { data: booking }
        if (url === '/bookings/b1/summary') return { data: summaryFor(booking) }
        if (url === '/bookings') return { data: { items: [], total: 0, page: 1, limit: 20 } }
        throw new Error(`unexpected GET ${url}`)
      })

      const { router } = renderWithAuth(bookingRoutes, {
        path: '/booking/b1',
        auth: { me: { ...ME, role }, status: 'authenticated' },
      })

      await waitFor(() => expect(router.state.location.pathname).toBe('/reception/bookings/BK123'))
    },
  )

  it('sends a signed-in customer to the booking page inside the dashboard', async () => {
    vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
      if (url === '/bookings/b1') return { data: booking }
      if (url === '/bookings/b1/summary') return { data: summaryFor(booking) }
      throw new Error(`unexpected GET ${url}`)
    })

    const { router } = renderWithAuth(bookingRoutes, {
      path: '/booking/b1',
      auth: { me: { ...ME, role: 'CUSTOMER' }, status: 'authenticated' },
    })

    await waitFor(() => expect(router.state.location.pathname).toBe('/my-bookings/b1'))
    expect(await screen.findByRole('heading', { level: 1, name: 'BK123' })).toBeInTheDocument()
  })

  it('shows the booking in the prototype layout with the customer’s actions in the header', async () => {
    vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
      if (url === '/bookings/b1') return { data: booking }
      if (url === '/bookings/b1/summary')
        return {
          data: summaryFor(booking, {
            payments: [
              {
                id: 'p1',
                method: 'VNPAY',
                purpose: 'DEPOSIT',
                status: 'PENDING',
                amount: 600_000,
                date: '2099-01-01T03:00:00.000Z',
              },
            ],
          }),
        }
      throw new Error(`unexpected GET ${url}`)
    })

    renderWithAuth(bookingRoutes, {
      path: '/my-bookings/b1',
      auth: { me: { ...ME, role: 'CUSTOMER' }, status: 'authenticated' },
    })

    expect(await screen.findByRole('heading', { level: 1, name: 'BK123' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Đặt phòng/ })).toHaveAttribute('href', '/my-bookings')
    for (const title of ['Lưu trú', 'Thanh toán', 'Yêu cầu dịch vụ', 'Hoá đơn', 'Khách']) {
      expect(screen.getByRole('heading', { name: title })).toBeInTheDocument()
    }
    expect(screen.getByText(/Đặt cọc · VNPay/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Đặt cọc qua VNPay/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Huỷ booking' })).toBeInTheDocument()
  })

  it('does not ask the customer to retype a code and sends none to the summary', async () => {
    const get = vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
      if (url === '/bookings/b1') return { data: booking }
      if (url === '/bookings/b1/summary') return { data: summaryFor(booking) }
      throw new Error(`unexpected GET ${url}`)
    })

    renderWithAuth(bookingRoutes, {
      path: '/my-bookings/b1',
      auth: { me: { ...ME, role: 'CUSTOMER' }, status: 'authenticated' },
    })

    await screen.findByRole('heading', { level: 1, name: 'BK123' })
    expect(get).toHaveBeenCalledWith('/bookings/b1/summary', { params: {} })
    expect(screen.queryByLabelText('Mã booking (vé)')).not.toBeInTheDocument()
  })

  it('shows a guest the summary with their booking code and a link to the lookup', async () => {
    const get = vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
      if (url === '/bookings/b1') return { data: booking }
      if (url === '/bookings/b1/summary') return { data: summaryFor(booking) }
      throw new Error(`unexpected GET ${url}`)
    })

    renderWithAuth(bookingRoutes, { path: '/booking/b1' })

    expect(await screen.findByRole('heading', { level: 1, name: 'BK123' })).toBeInTheDocument()
    expect(get).toHaveBeenCalledWith('/bookings/b1/summary', { params: { code: 'BK123' } })
    expect(screen.getByRole('link', { name: /Tra cứu đặt phòng/ })).toHaveAttribute(
      'href',
      '/booking/lookup',
    )
  })

  it('sends the booking code for a guest who opened the page without ?code', async () => {
    vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
      if (url === '/bookings/b1') return { data: booking }
      if (url === '/bookings/b1/summary') return { data: summaryFor(booking) }
      throw new Error(`unexpected GET ${url}`)
    })
    const post = vi.spyOn(api, 'post').mockResolvedValue({
      data: { transactionRef: 'TXN9', paymentUrl: 'https://vnpay.test/pay', amount: 600_000 },
    })

    renderWithAuth(bookingRoutes, { path: '/booking/b1' })

    fireEvent.click(await screen.findByRole('button', { name: /Đặt cọc qua VNPay/ }))
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/payments/deposit', { bookingId: 'b1', code: 'BK123' }),
    )

    fireEvent.click(screen.getByRole('button', { name: 'Huỷ booking' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Xác nhận huỷ' }))
    await waitFor(() => expect(post).toHaveBeenCalledWith('/bookings/b1/cancel', { code: 'BK123' }))
  })

  it('shows a paid-in-full state and hides the final payment button', async () => {
    const paid = {
      ...booking,
      status: 'CONFIRMED',
      paidAmount: 2_000_000,
      balanceDue: 0,
      invoiceStatus: 'PAID',
    }
    vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
      if (url === '/bookings/b1') return { data: paid }
      if (url === '/bookings/b1/summary') return { data: summaryFor(paid) }
      throw new Error(`unexpected GET ${url}`)
    })

    renderWithAuth(bookingRoutes, { path: '/booking/b1' })

    expect(await screen.findByText(/Đơn này đã thanh toán đủ/)).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Thanh toán phần còn lại/ }),
    ).not.toBeInTheDocument()
  })

  it('shows the final payment button when a balance is still due', async () => {
    const owing = {
      ...booking,
      status: 'CONFIRMED',
      paidAmount: 600_000,
      balanceDue: 1_400_000,
      invoiceStatus: 'PARTIALLY_PAID',
    }
    vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
      if (url === '/bookings/b1') return { data: owing }
      if (url === '/bookings/b1/summary') return { data: summaryFor(owing) }
      throw new Error(`unexpected GET ${url}`)
    })
    const post = vi.spyOn(api, 'post').mockResolvedValue({
      data: { transactionRef: 'TXN9', paymentUrl: 'https://vnpay.test/pay', amount: 1_400_000 },
    })

    renderWithAuth(bookingRoutes, { path: '/booking/b1' })

    fireEvent.click(await screen.findByRole('button', { name: /Thanh toán phần còn lại/ }))
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        '/payments/final',
        expect.objectContaining({ bookingId: 'b1' }),
      ),
    )
  })

  it('shows the expired state and hides the deposit action', async () => {
    const expired = {
      ...booking,
      id: 'b2',
      code: 'BK999',
      status: 'EXPIRED',
      holdExpiresAt: undefined,
    }
    vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
      if (url === '/bookings/b2') return { data: expired }
      if (url === '/bookings/b2/summary') return { data: summaryFor(expired) }
      throw new Error(`unexpected GET ${url}`)
    })

    renderWithAuth(bookingRoutes, { path: '/booking/b2' })

    expect(await screen.findByText('Hết hạn')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Đặt cọc qua VNPay/ })).not.toBeInTheDocument()
  })

  it('shows cancellation confirmation dialog and executes cancellation', async () => {
    vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
      if (url === '/bookings/b1') return { data: { ...booking, status: 'CONFIRMED' } }
      if (url === '/bookings/b1/summary')
        return { data: summaryFor(booking, { status: 'CONFIRMED' }) }
      throw new Error(`unexpected GET ${url}`)
    })
    const post = vi.spyOn(api, 'post').mockResolvedValue({ data: {} })

    renderWithAuth(bookingRoutes, { path: '/booking/b1' })

    fireEvent.click(await screen.findByRole('button', { name: 'Huỷ booking' }))

    expect(await screen.findByRole('alertdialog')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận huỷ' }))

    await waitFor(() => {
      expect(post).toHaveBeenCalledWith('/bookings/b1/cancel', expect.anything())
    })
  })
})

describe('LookupBookingPage', () => {
  afterEach(() => vi.restoreAllMocks())

  it('resolves the booking code and opens the booking detail', async () => {
    vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
      if (url === '/bookings/by-code/BK456') return { data: { id: 'b123' } }
      if (url === '/bookings/b123') return { data: { ...booking, id: 'b123', code: 'BK456' } }
      if (url === '/bookings/b123/summary')
        return { data: summaryFor({ ...booking, id: 'b123', code: 'BK456' }) }
      throw new Error(`unexpected GET ${url}`)
    })

    const { router } = renderWithAuth(bookingRoutes, { path: '/booking/lookup' })
    expect(screen.getByRole('heading', { name: 'Tra cứu đặt phòng' })).toBeInTheDocument()
    // Không còn ô ID: chỉ nhập mã booking (vé).
    expect(screen.queryByLabelText(/Mã định danh booking/i)).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/Mã booking/i), { target: { value: 'BK456' } })
    fireEvent.click(screen.getByRole('button', { name: 'Mở booking' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/booking/b123'))
    expect(router.state.location.search).toBe('?code=BK456')
  })

  it('shows an error when the booking code is not found', async () => {
    vi.spyOn(api, 'get').mockRejectedValue(new Error('Booking not found for this code'))

    renderWithAuth(bookingRoutes, { path: '/booking/lookup' })
    fireEvent.change(screen.getByLabelText(/Mã booking/i), { target: { value: 'BKNOPE' } })
    fireEvent.click(screen.getByRole('button', { name: 'Mở booking' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/Không tìm thấy đơn|not found/i)
  })
})

describe('PaymentReturnPage (server-authoritative)', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => {
    vi.restoreAllMocks()
    window.history.replaceState({}, '', '/')
  })

  it('flags money that arrived after the hold expired for reconciliation', async () => {
    const path = '/payment/vnpay-return?vnp_TxnRef=TXN-LATE&vnp_ResponseCode=00'
    window.history.replaceState({}, '', path)
    vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
      if (url.startsWith('/payments/vnpay/return'))
        return {
          data: {
            transactionRef: 'TXN-LATE',
            status: 'SUCCESS',
            responseCode: '00',
            bookingId: 'b2',
          },
        }
      if (url === '/bookings/b2')
        return {
          data: {
            ...booking,
            id: 'b2',
            code: 'BK999',
            status: 'EXPIRED',
            holdExpiresAt: undefined,
          },
        }
      throw new Error(`unexpected GET ${url}`)
    })

    renderWithAuth(bookingRoutes, { path })

    // Tiền về sau hạn giữ phòng: hiện thông báo đối soát, KHÔNG kẹt ở "đang hoàn tất".
    expect(
      await screen.findByText(/đã nhận thanh toán nhưng phòng không còn được giữ/i),
    ).toBeInTheDocument()
    expect(screen.queryByText(/đang hoàn tất xác nhận booking/i)).not.toBeInTheDocument()
  })

  function mockReturn(purpose: 'DEPOSIT' | 'FINAL', status: string, bookingStatus: string) {
    const path = '/payment/vnpay-return?vnp_TxnRef=TXN1&vnp_ResponseCode=00'
    window.history.replaceState({}, '', path)
    vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
      if (url.startsWith('/payments/vnpay/return'))
        return {
          data: {
            transactionRef: 'TXN1',
            status,
            responseCode: status === 'SUCCESS' ? '00' : '24',
            bookingId: 'b1',
            purpose,
          },
        }
      if (url === '/bookings/b1') return { data: { ...booking, status: bookingStatus } }
      throw new Error(`unexpected GET ${url}`)
    })
    return path
  }

  it('titles a successful deposit as a confirmed booking', async () => {
    renderWithAuth(bookingRoutes, { path: mockReturn('DEPOSIT', 'SUCCESS', 'CONFIRMED') })

    expect(
      await screen.findByRole('heading', { name: 'Đặt phòng thành công.' }),
    ).toBeInTheDocument()
  })

  it('titles a successful final payment as a payment, not a booking', async () => {
    renderWithAuth(bookingRoutes, { path: mockReturn('FINAL', 'SUCCESS', 'CHECKED_IN') })

    expect(
      await screen.findByRole('heading', { name: 'Thanh toán thành công.' }),
    ).toBeInTheDocument()
    expect(await screen.findByText(/đã nhận khoản thanh toán còn lại/i)).toBeInTheDocument()
    expect(screen.queryByText(/Đặt phòng thành công/)).not.toBeInTheDocument()
  })

  it('does not mention the room hold when a final payment fails', async () => {
    renderWithAuth(bookingRoutes, { path: mockReturn('FINAL', 'CANCELLED', 'CHECKED_IN') })

    expect(
      await screen.findByRole('heading', { name: 'Thanh toán chưa thành công' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/thử lại từ trang chi tiết booking/i)).toBeInTheDocument()
    expect(screen.queryByText(/phòng vẫn đang được giữ/i)).not.toBeInTheDocument()
  })
})
