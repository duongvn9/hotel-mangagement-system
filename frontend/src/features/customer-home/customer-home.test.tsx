import { screen, waitFor, within } from '@testing-library/react'
import { ME, renderWithAuth } from '@/features/auth/test-utils'
import type { MyBookingItem } from '@/features/booking/api'
import { api } from '@/lib/api-client'
import { customerHomeRoutes } from './routes'

const customer = { ...ME, role: 'CUSTOMER', fullName: 'Nguyễn Minh Anh' }

const booking = (overrides: Partial<MyBookingItem> = {}): MyBookingItem => ({
  id: 'b1',
  code: 'BK-1',
  status: 'CONFIRMED',
  checkIn: '2099-12-01T00:00:00.000Z',
  checkOut: '2099-12-03T00:00:00.000Z',
  adultCount: 1,
  childCount: 1,
  roomCount: 1,
  roomTotal: 2_000_000,
  depositAmount: 600_000,
  createdAt: '2026-11-01T00:00:00.000Z',
  ...overrides,
})

function mockApi(bookings: MyBookingItem[] | Error, orderTotal: number | Error = 4) {
  vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
    if (url === '/bookings/mine') {
      if (bookings instanceof Error) throw bookings
      return { data: bookings } as never
    }
    if (url === '/service-orders/me') {
      if (orderTotal instanceof Error) throw orderTotal
      return { data: { items: [], total: orderTotal, page: 1, limit: 1 } } as never
    }
    return { data: {} } as never
  })
}

function renderHome(me = customer) {
  return renderWithAuth([...customerHomeRoutes, { path: '/login', element: <p>đăng nhập</p> }], {
    path: '/customer/dashboard',
    auth: { me, status: 'authenticated' },
  })
}

describe('CustomerHomePage', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('greets the guest by given name and offers a new booking', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date(2026, 10, 6, 20, 0) })
    mockApi([])
    renderHome()
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Chào buổi tối, Anh' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Tổng quan')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Đặt phòng mới' })).toHaveAttribute('href', '/search')
  })

  it('greets without a trailing comma when the name is blank', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date(2026, 10, 6, 20, 0) })
    mockApi([])
    renderHome({ ...customer, fullName: ' ' })
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Chào buổi tối' }),
    ).toBeInTheDocument()
  })

  it('shows the four stat cards', async () => {
    mockApi(
      [
        booking({ id: '1', paidAmount: 500_000 }),
        booking({
          id: '2',
          status: 'CHECKED_OUT',
          checkIn: '2026-01-01T00:00:00.000Z',
          checkOut: '2026-01-04T00:00:00.000Z',
          paidAmount: 250_000,
        }),
      ],
      4,
    )
    renderHome()
    const stat = async (label: string) =>
      (await screen.findByText(label)).parentElement as HTMLElement
    expect(within(await stat('Đặt phòng')).getByText('2')).toBeInTheDocument()
    expect(within(await stat('Số đêm đã ở')).getByText('3')).toBeInTheDocument()
    expect(within(await stat('Yêu cầu dịch vụ')).getByText('4')).toBeInTheDocument()
    expect(within(await stat('Tổng đã thanh toán')).getByText(/750\.000/)).toBeInTheDocument()
  })

  it('shows the paid total card with 0 ₫ when nothing has been paid', async () => {
    mockApi([])
    renderHome()
    const card = (await screen.findByText('Tổng đã thanh toán')).parentElement as HTMLElement
    expect(within(card).getByText(/^0\s?₫$/)).toBeInTheDocument()
  })

  it('shows the next stay with dates, status and a link to the booking', async () => {
    mockApi([booking()])
    renderHome()
    expect(await screen.findByText('Kỳ nghỉ tiếp theo')).toBeInTheDocument()
    expect(screen.getByText('Nhận phòng')).toBeInTheDocument()
    expect(screen.getByText('Trả phòng')).toBeInTheDocument()
    expect(screen.getByText('2 khách')).toBeInTheDocument()
    expect(screen.getByText(/2 đêm/)).toBeInTheDocument()
    expect(screen.getByText('Đã xác nhận')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Xem đặt phòng/ })).toHaveAttribute(
      'href',
      '/my-bookings/b1',
    )
    expect(screen.queryByRole('link', { name: 'Đặt dịch vụ' })).not.toBeInTheDocument()
  })

  it('offers room service only for a checked-in stay', async () => {
    mockApi([booking({ status: 'CHECKED_IN' })])
    renderHome()
    expect(await screen.findByRole('link', { name: 'Đặt dịch vụ' })).toHaveAttribute(
      'href',
      '/customer/service-orders?bookingId=b1',
    )
  })

  it('falls back to the booking code and omits the image when room details are missing', async () => {
    mockApi([booking()])
    renderHome()
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Đặt phòng BK-1' }),
    ).toBeInTheDocument()
    expect(document.querySelector('img')).toBeNull()
  })

  it('shows the room type, image and room number when the API provides them', async () => {
    mockApi([
      booking({
        roomTypeName: 'Phòng Đôi Hướng Vườn',
        roomTypeImage: '/room-types/garden.jpg',
        roomNumber: '101',
        roomFloor: 1,
      }),
    ])
    renderHome()
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Phòng Đôi Hướng Vườn' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Phòng 101 · Tầng 1')).toBeInTheDocument()
    expect(document.querySelector('img')).toHaveAttribute('alt', '')
  })

  it('shows an empty state when there is no upcoming stay', async () => {
    mockApi([booking({ status: 'CANCELLED' })])
    renderHome()
    expect(await screen.findByText('Chưa có kỳ nghỉ sắp tới')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Xem phòng' })).toHaveAttribute('href', '/search')
  })

  it('links to the three shortcuts', async () => {
    mockApi([])
    renderHome()
    expect(await screen.findByRole('link', { name: 'Đặt dịch vụ phòng' })).toHaveAttribute(
      'href',
      '/customer/service-orders',
    )
    expect(screen.getByRole('link', { name: 'Gửi đánh giá' })).toHaveAttribute(
      'href',
      '/my-feedback',
    )
    expect(screen.getByRole('link', { name: 'Lịch sử đặt phòng' })).toHaveAttribute(
      'href',
      '/my-bookings',
    )
  })

  it('shows a loading status first and an alert when the bookings fail', async () => {
    mockApi(new Error('boom'))
    renderHome()
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })

  it('shows a dash for the service requests when only that call fails', async () => {
    mockApi([booking()], new Error('boom'))
    renderHome()
    await waitFor(() => expect(screen.getByText('Kỳ nghỉ tiếp theo')).toBeInTheDocument())
    const card = (await screen.findByText('Yêu cầu dịch vụ')).parentElement as HTMLElement
    expect(within(card).getByText('—')).toBeInTheDocument()
  })

  it('keeps other roles out', async () => {
    mockApi([])
    renderHome({ ...ME, role: 'RECEPTIONIST' })
    expect(await screen.findByText(/chưa được cấp quyền/)).toBeInTheDocument()
  })
})
