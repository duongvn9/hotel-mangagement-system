import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { api } from '@/lib/api-client'
import { ME, renderWithAuth } from '@/features/auth/test-utils'
import { dashboardRoutes } from './routes'
import type { ReceptionDashboard } from './api'

const receptionist = { ...ME, id: 'r1', email: 'reception@hms.local', role: 'RECEPTIONIST' }

const data = (overrides: Partial<ReceptionDashboard> = {}): ReceptionDashboard => ({
  generatedAt: '2026-10-28T03:15:00Z',
  frontDesk: {
    available: true,
    date: '2026-10-28',
    arrivals: { total: 9, awaitingDeposit: 2, ready: 5, checkedIn: 2 },
    departures: { total: 4, awaitingCheckOut: 3, checkedOut: 1 },
  },
  rooms: {
    available: true,
    date: '2026-10-28',
    total: 20,
    free: 8,
    held: 1,
    reserved: 4,
    inHouse: 5,
    maintenance: 1,
    cleaning: 1,
  },
  requests: {
    available: true,
    serviceOrdersPendingReview: 6,
    issuesPendingReview: 3,
    feedbackUnreplied: 12,
  },
  ...overrides,
})

function renderPage(role = receptionist) {
  return renderWithAuth(dashboardRoutes, {
    path: '/reception/dashboard',
    auth: { me: role, status: 'authenticated' },
  })
}

const region = (name: string) => within(screen.getByRole('region', { name }))

describe('Reception dashboard', () => {
  afterEach(() => vi.restoreAllMocks())

  it.each(['CUSTOMER', 'SERVICE_STAFF', 'OPERATIONS_STAFF'])('blocks %s', (role) => {
    renderPage({ ...receptionist, role })
    expect(screen.getByText('Không có quyền truy cập')).toBeInTheDocument()
  })

  it('lets the manager in too', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({ data: data() })
    renderPage({ ...receptionist, role: 'MANAGER' })
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Tổng quan lễ tân' }),
    ).toBeInTheDocument()
  })

  it("shows today's arrivals, departures, rooms and pending requests", async () => {
    const get = vi.spyOn(api, 'get').mockResolvedValue({ data: data() })
    renderPage()

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Tổng quan lễ tân' }),
    ).toBeInTheDocument()
    expect(get).toHaveBeenCalledWith('/dashboard/reception')

    const arrivals = region('Khách đến hôm nay')
    expect((await arrivals.findByText('Tổng')).nextElementSibling).toHaveTextContent('9')
    expect(arrivals.getByText('Chưa cọc').nextElementSibling).toHaveTextContent('2')
    expect(arrivals.getByText('Sẵn sàng nhận phòng').nextElementSibling).toHaveTextContent('5')
    expect(arrivals.getByText('Đã nhận phòng').nextElementSibling).toHaveTextContent('2')
    expect(arrivals.getByRole('link', { name: 'Xem danh sách đến và đi' })).toHaveAttribute(
      'href',
      '/reception/front-desk',
    )

    const departures = region('Khách đi hôm nay')
    expect(departures.getByText('Tổng').nextElementSibling).toHaveTextContent('4')
    expect(departures.getByText('Chờ trả phòng').nextElementSibling).toHaveTextContent('3')
    expect(departures.getByText('Đã trả phòng').nextElementSibling).toHaveTextContent('1')

    const rooms = region('Phòng hôm nay')
    expect(rooms.getByText('Tổng số phòng').nextElementSibling).toHaveTextContent('20')
    expect(rooms.getByText('Trống').nextElementSibling).toHaveTextContent('8')
    expect(rooms.getByText('Đang ở').nextElementSibling).toHaveTextContent('5')
    expect(rooms.getByText('Bảo trì').nextElementSibling).toHaveTextContent('1')
    expect(rooms.getByRole('link', { name: 'Xem sơ đồ phòng' })).toHaveAttribute(
      'href',
      '/reception/rooms',
    )

    const requests = region('Việc cần xử lý')
    expect(requests.getByRole('link', { name: /Yêu cầu dịch vụ chờ duyệt/ })).toHaveAttribute(
      'href',
      '/staff/service-orders',
    )
    expect(requests.getByRole('link', { name: /Sự cố chờ duyệt/ })).toHaveAttribute(
      'href',
      '/staff/issues',
    )
    expect(requests.getByRole('link', { name: /Phản hồi chưa trả lời/ })).toHaveAttribute(
      'href',
      '/staff/feedback',
    )
    expect(requests.getByRole('link', { name: /Yêu cầu dịch vụ chờ duyệt/ })).toHaveTextContent('6')
    expect(requests.getByRole('link', { name: /Phản hồi chưa trả lời/ })).toHaveTextContent('12')
  })

  it('offers shortcuts to the common reception tasks', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({ data: data() })
    renderPage()
    await screen.findByText(/Cập nhật lúc/)
    const shortcuts = within(screen.getByRole('navigation', { name: 'Lối tắt' }))
    expect(shortcuts.getByRole('link', { name: 'Tạo booking' })).toHaveAttribute(
      'href',
      '/reception/booking/new',
    )
    expect(shortcuts.getByRole('link', { name: 'Tìm khách' })).toHaveAttribute(
      'href',
      '/reception/guests',
    )
    expect(shortcuts.getByRole('link', { name: 'Danh sách booking' })).toHaveAttribute(
      'href',
      '/reception/bookings',
    )
  })

  it('keeps the other cards when one source fails and lets staff retry', async () => {
    const get = vi
      .spyOn(api, 'get')
      .mockResolvedValueOnce({
        data: data({ rooms: { available: false, reason: 'error' } }),
      })
      .mockResolvedValue({ data: data() })
    renderPage()

    const rooms = screen.getByRole('region', { name: 'Phòng hôm nay' })
    expect(await within(rooms).findByRole('alert')).toHaveTextContent('Không tải được số liệu')
    expect(region('Khách đến hôm nay').getByText('Tổng')).toBeInTheDocument()

    fireEvent.click(within(rooms).getByRole('button', { name: 'Thử lại' }))
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2))
    expect(await region('Phòng hôm nay').findByText('Tổng số phòng')).toBeInTheDocument()
  })

  it('shows the error and a retry when the whole request fails', async () => {
    vi.spyOn(api, 'get').mockRejectedValue({
      isAxiosError: true,
      response: { status: 500, data: { message: 'Boom' } },
    })
    renderPage()
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeInTheDocument()
  })

  it('refreshes on demand and shows when the numbers were taken', async () => {
    const get = vi.spyOn(api, 'get').mockResolvedValue({ data: data() })
    renderPage()
    expect(await screen.findByText(/Cập nhật lúc/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Làm mới' }))
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2))
  })
})
