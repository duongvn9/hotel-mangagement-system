import { screen } from '@testing-library/react'
import { api } from '@/lib/api-client'
import { ME, renderWithAuth } from '@/features/auth/test-utils'
import { dashboardRoutes } from './routes'
import type { ReceptionDashboard } from './api'

const receptionist = {
  ...ME,
  id: 'r1',
  email: 'reception@hms.local',
  fullName: 'Trần Thị Lễ Tân',
  role: 'RECEPTIONIST',
}

const sameDayData = {
  date: '2026-10-28',
  summary: {
    arrivals: { total: 9, awaitingDeposit: 2, ready: 5, checkedIn: 2 },
    departures: { total: 4, awaitingCheckOut: 3, checkedOut: 1 },
  },
  arrivals: [
    {
      id: 'b1',
      code: 'BK2403',
      guestName: 'Lê Thu Hà',
      status: 'CONFIRMED',
      rooms: [{ id: 'rm1', roomNumber: '205' }],
    },
  ],
  departures: [
    {
      id: 'b2',
      code: 'BK2401',
      guestName: 'Nguyễn Minh Anh',
      status: 'CHECKED_IN',
      rooms: [{ id: 'rm2', roomNumber: '101' }],
    },
  ],
}

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

function mockApi(dashboardOverride?: Partial<ReceptionDashboard>) {
  return vi.spyOn(api, 'get').mockImplementation(async (url) => {
    if (url.includes('/front-desk/same-day')) {
      return { data: sameDayData } as never
    }
    return { data: data(dashboardOverride) } as never
  })
}

function renderPage(role = receptionist) {
  return renderWithAuth(dashboardRoutes, {
    path: '/reception/dashboard',
    auth: { me: role, status: 'authenticated' },
  })
}

describe('Reception dashboard', () => {
  afterEach(() => vi.restoreAllMocks())

  it.each(['CUSTOMER', 'SERVICE_STAFF', 'OPERATIONS_STAFF'])('blocks %s', (role) => {
    renderPage({ ...receptionist, role })
    expect(screen.getByText('Không có quyền truy cập')).toBeInTheDocument()
  })

  it('lets the manager in too', async () => {
    mockApi()
    renderPage({ ...receptionist, role: 'MANAGER' })
    const heading = await screen.findByRole('heading', { level: 1 })
    expect(heading).toHaveTextContent(/Chào buổi|Tân/)
  })

  it("shows today's stat cards, arrivals and departures panels matching the prototype", async () => {
    const get = mockApi()
    renderPage()

    // Wait for data to load
    await screen.findByText('Lê Thu Hà')

    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading).toHaveTextContent(/Chào buổi|Tân/)
    expect(screen.getByText('Lễ tân')).toBeInTheDocument()
    expect(screen.getByText('Tình hình tại quầy lễ tân hôm nay.')).toBeInTheDocument()

    // Action buttons
    expect(screen.getByRole('link', { name: 'Mở quầy lễ tân' })).toHaveAttribute(
      'href',
      '/reception/front-desk',
    )
    expect(screen.getByRole('link', { name: /Tại quầy/ })).toHaveAttribute(
      'href',
      '/reception/booking/new',
    )

    // 4 StatCards
    expect(screen.getByText('Khách đến hôm nay')).toBeInTheDocument()
    expect(screen.getAllByText('Khách trả phòng').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Phòng trống')).toBeInTheDocument()
    expect(screen.getByText('8 / 20')).toBeInTheDocument()
    expect(screen.getByText('Việc cần xử lý')).toBeInTheDocument()
    expect(screen.getByText('21')).toBeInTheDocument() // 6 + 3 + 12

    // 2 Panels
    expect(screen.getByRole('heading', { level: 2, name: 'Khách đến' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Nhận phòng →' })).toHaveAttribute(
      'href',
      '/reception/front-desk',
    )
    expect(screen.getByText('Lê Thu Hà')).toBeInTheDocument()
    expect(screen.getByText(/BK2403 · Phòng 205/)).toBeInTheDocument()
    expect(screen.getByText('Đã xác nhận')).toBeInTheDocument()

    expect(screen.getByRole('heading', { level: 2, name: 'Khách trả phòng' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Trả phòng →' })).toHaveAttribute(
      'href',
      '/reception/front-desk',
    )
    expect(screen.getByText('Nguyễn Minh Anh')).toBeInTheDocument()
    expect(screen.getByText(/BK2401 · Phòng 101/)).toBeInTheDocument()
    expect(screen.getByText('Đã nhận phòng')).toBeInTheDocument()

    expect(get).toHaveBeenCalledWith('/dashboard/reception')
  })

  it('shows the error and a retry when the request fails', async () => {
    vi.spyOn(api, 'get').mockRejectedValue({
      isAxiosError: true,
      response: { status: 500, data: { message: 'Boom' } },
    })
    renderPage()
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeInTheDocument()
  })

  it('renders empty states when there are no arrivals or departures', async () => {
    vi.spyOn(api, 'get').mockImplementation(async (url) => {
      if (url.includes('/front-desk/same-day')) {
        return {
          data: {
            date: '2026-10-28',
            summary: {
              arrivals: { total: 0, awaitingDeposit: 0, ready: 0, checkedIn: 0 },
              departures: { total: 0, awaitingCheckOut: 0, checkedOut: 0 },
            },
            arrivals: [],
            departures: [],
          },
        } as never
      }
      return { data: data() } as never
    })
    renderPage()

    expect(await screen.findByText('Không có khách đến.')).toBeInTheDocument()
    expect(screen.getByText('Không có khách đi.')).toBeInTheDocument()
  })
})
