import { fireEvent, screen, within } from '@testing-library/react'
import { useLocation } from 'react-router'
import { api } from '@/lib/api-client'
import { ME, renderWithAuth } from '@/features/auth/test-utils'
import { todayISO } from '@/features/booking/utils'
import { HomePage } from './HomePage'

function SearchProbe() {
  const { pathname, search } = useLocation()
  return <p data-testid="search">{`${pathname}${search}`}</p>
}

const routes = [
  { path: '/', element: <HomePage /> },
  { path: '/search', element: <SearchProbe /> },
]

const addDays = (day: string, count: number) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + count * 86_400_000).toISOString().slice(0, 10)

function renderHome(me: typeof ME | null = null) {
  vi.spyOn(api, 'get').mockResolvedValue({ data: { status: 'ok' } })
  return renderWithAuth(routes, {
    auth: me ? { me, status: 'authenticated' } : { me: null, status: 'anonymous' },
  })
}

const bar = () => screen.getByRole('search', { name: 'Tìm phòng trống' })

describe('HomePage', () => {
  afterEach(() => vi.restoreAllMocks())

  it('leads with one heading and an illustration of the lake', () => {
    renderHome()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('img', { name: /mặt hồ.*lau sậy/i })).toBeInTheDocument()
  })

  it('prefills the search bar with tonight and tomorrow for two guests', () => {
    renderHome()
    const today = todayISO()
    expect(within(bar()).getByLabelText(/Nhận phòng/)).toHaveValue(today)
    expect(within(bar()).getByLabelText(/Trả phòng/)).toHaveValue(addDays(today, 1))
    expect(within(bar()).getByLabelText(/Số khách/)).toHaveValue(2)
  })

  it('opens the room search with the chosen dates and guests', async () => {
    renderHome()
    fireEvent.change(within(bar()).getByLabelText(/Nhận phòng/), {
      target: { value: '2099-01-10' },
    })
    fireEvent.change(within(bar()).getByLabelText(/Trả phòng/), { target: { value: '2099-01-13' } })
    fireEvent.change(within(bar()).getByLabelText(/Số khách/), { target: { value: '3' } })
    fireEvent.click(within(bar()).getByRole('button', { name: 'Tìm phòng' }))

    expect(await screen.findByTestId('search')).toHaveTextContent(
      '/search?checkIn=2099-01-10&checkOut=2099-01-13&guests=3',
    )
  })

  it('does not search for a stay that ends before it starts', () => {
    renderHome()
    fireEvent.change(within(bar()).getByLabelText(/Nhận phòng/), {
      target: { value: '2099-01-10' },
    })
    fireEvent.change(within(bar()).getByLabelText(/Trả phòng/), { target: { value: '2099-01-10' } })
    fireEvent.click(within(bar()).getByRole('button', { name: 'Tìm phòng' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Ngày trả phòng phải sau ngày nhận phòng.')
    expect(screen.queryByTestId('search')).not.toBeInTheDocument()
  })

  it('needs at least one guest', () => {
    renderHome()
    fireEvent.change(within(bar()).getByLabelText(/Số khách/), { target: { value: '0' } })
    fireEvent.click(within(bar()).getByRole('button', { name: 'Tìm phòng' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Số khách phải từ 1 trở lên.')
    expect(screen.queryByTestId('search')).not.toBeInTheDocument()
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
      '/reception/front-desk',
    )
    expect(screen.getByText(/Lễ tân/)).toBeInTheDocument()
  })

  it('shows the backend status only to developers', async () => {
    renderHome()
    expect(await screen.findByText(/Backend API/)).toBeInTheDocument()
  })
})
