import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { api } from '@/lib/api-client'
import { ME, renderWithAuth } from '@/features/auth/test-utils'
import { bookingRoutes } from './routes'
import type { BookingListPage } from './api'

const receptionist = { ...ME, id: 'u2', email: 'reception@hms.local', role: 'RECEPTIONIST' }

const page = (overrides: Partial<BookingListPage> = {}): BookingListPage => ({
  items: [
    {
      id: 'b1',
      code: 'BKLIST1',
      status: 'CONFIRMED',
      guestName: 'Nguyễn Văn A',
      guestEmail: 'a@example.test',
      guestPhone: '0900000001',
      rooms: [{ id: 'r1', roomNumber: '101', roomTypeName: 'Deluxe' }],
      checkIn: '2099-01-09T17:00:00.000Z',
      checkOut: '2099-01-11T17:00:00.000Z',
      adultCount: 2,
      childCount: 1,
      source: 'FRONT_DESK',
      roomTotal: 2_000_000,
      createdAt: '2099-01-01T00:00:00.000Z',
      walkIn: true,
    },
    {
      id: 'b2',
      code: 'BKLIST2',
      status: 'PENDING_DEPOSIT',
      guestName: 'Trần Thị B',
      guestEmail: 'b@example.test',
      guestPhone: '0900000002',
      rooms: [{ id: 'r2', roomNumber: '102', roomTypeName: 'Suite' }],
      checkIn: '2099-02-09T17:00:00.000Z',
      checkOut: '2099-02-11T17:00:00.000Z',
      adultCount: 1,
      childCount: 0,
      source: 'ONLINE',
      roomTotal: 3_000_000,
      createdAt: '2099-01-02T00:00:00.000Z',
      walkIn: false,
    },
  ],
  total: 2,
  page: 1,
  limit: 20,
  ...overrides,
})

function renderPage(role = receptionist) {
  return renderWithAuth(bookingRoutes, {
    path: '/reception/bookings',
    auth: { me: role, status: 'authenticated' },
  })
}

describe('BookingListPage', () => {
  it('blocks roles other than receptionist/manager', () => {
    renderPage({ ...receptionist, role: 'CUSTOMER' })
    expect(screen.getByText('Không có quyền truy cập')).toBeInTheDocument()
  })

  it('lists bookings with status, rooms and the walk-in marker', async () => {
    const get = vi.spyOn(api, 'get').mockResolvedValue({ data: page() })
    renderPage()

    expect(await screen.findByText('BKLIST1')).toBeInTheDocument()
    expect(screen.getByText('BKLIST2')).toBeInTheDocument()
    expect(screen.getByText('Nguyễn Văn A')).toBeInTheDocument()
    const rows = within(screen.getByRole('list'))
    expect(rows.getByText('Đã xác nhận')).toBeInTheDocument()
    expect(rows.getByText('Chờ đặt cọc')).toBeInTheDocument()
    expect(rows.getByText(/101 · Deluxe/)).toBeInTheDocument()
    expect(rows.getAllByText('Tại quầy')).toHaveLength(1)
    expect(rows.getByText('3 khách')).toBeInTheDocument()
    expect(rows.getByText('1 khách')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /BKLIST1/ })).toHaveAttribute('href', '/booking/b1')
    expect(get).toHaveBeenCalledWith('/bookings', { params: { page: 1, limit: 20 } })
  })

  it('sends the filters to the API and returns to page 1', async () => {
    const get = vi.spyOn(api, 'get').mockResolvedValue({ data: page() })
    renderPage()
    await screen.findByText('BKLIST1')

    fireEvent.change(screen.getByLabelText('Tìm kiếm'), { target: { value: ' BKLIST2 ' } })
    fireEvent.change(screen.getByLabelText('Trạng thái'), { target: { value: 'CANCELLED' } })
    fireEvent.change(screen.getByLabelText('Nhận phòng từ'), { target: { value: '2099-02-01' } })
    fireEvent.change(screen.getByLabelText('Nhận phòng đến'), { target: { value: '2099-02-28' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lọc' }))

    await waitFor(() =>
      expect(get).toHaveBeenLastCalledWith('/bookings', {
        params: {
          page: 1,
          limit: 20,
          q: 'BKLIST2',
          status: 'CANCELLED',
          checkInFrom: '2099-02-01',
          checkInTo: '2099-02-28',
        },
      }),
    )
  })

  it('starts from the search text in the URL', async () => {
    const get = vi.spyOn(api, 'get').mockResolvedValue({ data: page() })
    renderWithAuth(bookingRoutes, {
      path: '/reception/bookings?q=ann%40example.test',
      auth: { me: receptionist, status: 'authenticated' },
    })
    await screen.findByText('BKLIST1')
    expect(get).toHaveBeenCalledWith('/bookings', {
      params: { page: 1, limit: 20, q: 'ann@example.test' },
    })
    expect(screen.getByLabelText('Tìm kiếm')).toHaveValue('ann@example.test')
  })

  it('pages through results', async () => {
    const get = vi.spyOn(api, 'get').mockResolvedValue({ data: page({ total: 45, limit: 20 }) })
    renderPage()
    await screen.findByText('BKLIST1')
    expect(screen.getByText('Trang 1 / 3 · 45 booking')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Trang trước' })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }))
    await waitFor(() =>
      expect(get).toHaveBeenLastCalledWith('/bookings', { params: { page: 2, limit: 20 } }),
    )
  })

  it('shows an empty state and an error state', async () => {
    vi.spyOn(api, 'get').mockResolvedValueOnce({ data: page({ items: [], total: 0 }) })
    const empty = renderPage()
    expect(await screen.findByText('Không có booking nào phù hợp.')).toBeInTheDocument()
    empty.unmount()

    vi.spyOn(api, 'get').mockRejectedValue({
      isAxiosError: true,
      response: { status: 500, data: { message: 'Boom' } },
    })
    renderPage()
    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })
})
