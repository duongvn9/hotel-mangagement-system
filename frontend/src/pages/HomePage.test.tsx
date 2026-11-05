import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { useLocation } from 'react-router'
import { ME, renderWithAuth } from '@/features/auth/test-utils'
import { api } from '@/lib/api-client'
import { HomePage } from './HomePage'

function SearchProbe() {
  const { pathname, search } = useLocation()
  return <p data-testid="search">{`${pathname}${search}`}</p>
}

const routes = [
  { path: '/', element: <HomePage /> },
  { path: '/search', element: <SearchProbe /> },
]

function renderHome(me: typeof ME | null = null) {
  vi.spyOn(api, 'get').mockImplementation(async (path: string) => {
    if (path === '/availability') {
      return {
        data: [
          {
            id: 'room-1',
            roomTypeId: 'type-deluxe',
            roomTypeName: 'Phòng Deluxe',
            pricePerNight: 1500000,
            capacity: 2,
          },
        ],
      } as any
    }
    return { data: { status: 'ok' } } as any
  })
  return renderWithAuth(routes, {
    auth: me ? { me, status: 'authenticated' } : { me: null, status: 'anonymous' },
  })
}

const bar = () => screen.getByRole('search', { name: 'Tìm phòng trống' })

describe('HomePage', () => {
  afterEach(() => vi.restoreAllMocks())

  it('leads with one heading and an illustration of the pool at sunset', () => {
    renderHome()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('img', { name: /hồ bơi.*hoàng hôn/i })).toBeInTheDocument()
  })

  it('submits the search bar with dates and guests', async () => {
    renderHome()
    const searchForm = bar()
    expect(searchForm).toBeInTheDocument()

    const submitBtn = within(searchForm).getByRole('button', {
      name: /Kiểm tra phòng trống/i,
    })
    expect(submitBtn).toBeInTheDocument()
    fireEvent.click(submitBtn)

    const probe = await screen.findByTestId('search')
    expect(probe).toHaveTextContent(
      /\/search\?checkIn=\d{4}-\d{2}-\d{2}&checkOut=\d{4}-\d{2}-\d{2}&guests=2/,
    )
  })

  it('shows featured room types when available', async () => {
    renderHome()
    expect(await screen.findByText('Phòng Deluxe')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Phòng & suite' })).toBeInTheDocument()
  })

  it('hides the "Phòng & suite" section when availability fails, but keeps ApiStatus', async () => {
    vi.spyOn(api, 'get').mockImplementation(async (path: string) => {
      if (path === '/availability') {
        throw new Error('API Error')
      }
      return { data: { status: 'ok' } } as any
    })
    renderWithAuth(routes, {
      auth: { me: null, status: 'anonymous' },
    })

    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'Phòng & suite' })).not.toBeInTheDocument(),
    )
    expect(await screen.findByText(/Backend API/)).toBeInTheDocument()
  })

  it('explains how booking works in three numbered steps', () => {
    renderHome()
    const steps = within(screen.getByRole('list', { name: 'Các bước đặt phòng' })).getAllByRole(
      'listitem',
    )
    expect(steps).toHaveLength(3)
    expect(steps[1]).toHaveTextContent('VNPay')
  })

  it('invites visitors to sign in or register', () => {
    renderHome()
    expect(screen.getByRole('link', { name: 'Đăng nhập' })).toHaveAttribute('href', '/login')
    expect(screen.getByRole('link', { name: 'Đăng ký' })).toHaveAttribute('href', '/register')
    expect(screen.queryByRole('link', { name: /Vào khu làm việc/ })).not.toBeInTheDocument()
  })

  it('points customers to their bookings and feedback', () => {
    renderHome({ ...ME, role: 'CUSTOMER' })
    expect(screen.getByRole('link', { name: 'Booking của tôi' })).toHaveAttribute(
      'href',
      '/my-bookings',
    )
    expect(screen.getByRole('link', { name: 'Phản hồi của tôi' })).toHaveAttribute(
      'href',
      '/my-feedback',
    )
    expect(screen.queryByRole('link', { name: 'Đăng nhập' })).not.toBeInTheDocument()
  })

  it('sends staff to their workspace', () => {
    renderHome({ ...ME, role: 'RECEPTIONIST', fullName: 'Trần Lễ Tân' })
    expect(screen.getByRole('link', { name: /Vào khu làm việc/ })).toHaveAttribute(
      'href',
      '/reception/dashboard',
    )
    expect(screen.getByText(/Lễ tân/)).toBeInTheDocument()
  })

  it('shows the backend status only to developers', async () => {
    renderHome()
    expect(await screen.findByText(/Backend API/)).toBeInTheDocument()
  })
})
