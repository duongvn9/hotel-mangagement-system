import { fireEvent, screen, waitFor } from '@testing-library/react'
import { api } from '@/lib/api-client'
import { ME, renderWithAuth } from '@/features/auth/test-utils'
import { bookingRoutes } from './routes'
import type { AvailableRoom, Booking } from './api'
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
    fireEvent.click(screen.getByRole('checkbox', { name: /Chọn phòng/ }))
    expect(await screen.findByText(/Tiếp tục đặt phòng/)).toBeInTheDocument()
  })

  it('defaults to upcoming dates when criteria are missing from the URL', async () => {
    vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
      if (url === '/availability') return { data: availableRooms }
      throw new Error(`unexpected GET ${url}`)
    })
    renderWithAuth(bookingRoutes, { path: '/search' })
    expect(await screen.findByRole('heading', { name: 'Deluxe' })).toBeInTheDocument()
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
    await screen.findAllByText('Tiền cọc')
    expect(screen.getAllByText('Tiền cọc')).toHaveLength(8)
    fireEvent.click(screen.getByLabelText('Trang sau'))
    expect(screen.getAllByText('Tiền cọc')).toHaveLength(2)
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
      if (url === '/bookings/service-catalog') return { data: { items: [] } }
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

  it('lets the guest pick add-on services sent with the contact details', async () => {
    const post = vi.spyOn(api, 'post').mockImplementation(async (url: string) => {
      if (url === '/bookings/hold') return { data: held }
      if (url === '/bookings/details') return { data: { ...held, status: 'PENDING_DEPOSIT' } }
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

    await waitFor(() => expect(router.state.location.pathname).toBe('/booking/b9'))
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

  it.each(['RECEPTIONIST', 'MANAGER'])(
    'sends %s to the staff booking page inside the dashboard',
    async (role) => {
      vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
        if (url === '/bookings/b1') return { data: booking }
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

  it('keeps a signed-in customer on the guest booking page', async () => {
    vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
      if (url === '/bookings/b1') return { data: booking }
      throw new Error(`unexpected GET ${url}`)
    })

    const { router } = renderWithAuth(bookingRoutes, {
      path: '/booking/b1',
      auth: { me: { ...ME, role: 'CUSTOMER' }, status: 'authenticated' },
    })

    expect(await screen.findByText('BK123')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/booking/b1')
  })

  it('sends the booking code for a guest who opened the page without ?code', async () => {
    vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
      if (url === '/bookings/b1') return { data: booking }
      throw new Error(`unexpected GET ${url}`)
    })
    const post = vi.spyOn(api, 'post').mockResolvedValue({
      data: { transactionRef: 'TXN9', paymentUrl: 'https://vnpay.test/pay', amount: 600_000 },
    })

    renderWithAuth(bookingRoutes, { path: '/booking/b1' })

    fireEvent.click(await screen.findByRole('button', { name: 'Đặt cọc qua VNPay' }))
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/payments/deposit', { bookingId: 'b1', code: 'BK123' }),
    )

    fireEvent.click(screen.getByRole('button', { name: 'Huỷ booking' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Xác nhận huỷ' }))
    await waitFor(() => expect(post).toHaveBeenCalledWith('/bookings/b1/cancel', { code: 'BK123' }))
  })

  it('shows the expired state and hides the deposit action', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({
      data: { ...booking, id: 'b2', code: 'BK999', status: 'EXPIRED', holdExpiresAt: undefined },
    })

    renderWithAuth(bookingRoutes, { path: '/booking/b2' })

    expect(await screen.findByText('Hết hạn')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Đặt cọc qua VNPay' })).not.toBeInTheDocument()
  })

  it('shows cancellation confirmation dialog and executes cancellation', async () => {
    vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
      if (url === '/bookings/b1') return { data: { ...booking, status: 'CONFIRMED' } }
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
  it('navigates to booking detail on submit', () => {
    const { router } = renderWithAuth(bookingRoutes, { path: '/booking/lookup' })
    expect(screen.getByRole('heading', { name: 'Tra cứu đặt phòng' })).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/Mã định danh booking/i), {
      target: { value: 'b123' },
    })
    fireEvent.change(screen.getByLabelText(/Mã booking/i), {
      target: { value: 'BK456' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Mở booking' }))

    expect(router.state.location.pathname).toBe('/booking/b123')
    expect(router.state.location.search).toBe('?code=BK456')
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
})
