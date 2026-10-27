import { fireEvent, screen, waitFor } from '@testing-library/react'
import { api } from '@/lib/api-client'
import { ME, renderWithAuth } from '@/features/auth/test-utils'
import { bookingRoutes } from './routes'
import type { GuestListPage } from './api'

const receptionist = { ...ME, id: 'u2', email: 'reception@hms.local', role: 'RECEPTIONIST' }

const page = (overrides: Partial<GuestListPage> = {}): GuestListPage => ({
  items: [
    {
      name: 'Ann Nguyễn',
      email: 'ann@example.test',
      phone: '0900000003',
      hasAccount: true,
      totalBookings: 3,
      completedStays: 1,
      lastCheckIn: '2099-01-09T17:00:00.000Z', // 2099-01-10 giờ VN
    },
    {
      name: 'Bob Trần',
      email: 'bob@example.test',
      phone: '0911111112',
      hasAccount: false,
      totalBookings: 1,
      completedStays: 0,
      lastCheckIn: null,
    },
  ],
  total: 2,
  page: 1,
  limit: 20,
  ...overrides,
})

function renderPage(role = receptionist) {
  return renderWithAuth(bookingRoutes, {
    path: '/reception/guests',
    auth: { me: role, status: 'authenticated' },
  })
}

function search(text: string) {
  fireEvent.change(screen.getByLabelText(/Tìm khách/), { target: { value: text } })
  fireEvent.click(screen.getByRole('button', { name: 'Tìm' }))
}

describe('GuestSearchPage', () => {
  it('blocks roles other than receptionist/manager', () => {
    renderPage({ ...receptionist, role: 'CUSTOMER' })
    expect(screen.getByText('Không có quyền truy cập')).toBeInTheDocument()
  })

  it('asks for a query before searching and rejects one that is too short', () => {
    const get = vi.spyOn(api, 'get')
    renderPage()
    expect(
      screen.getByText('Nhập tên, email, số điện thoại hoặc mã booking để tìm khách.'),
    ).toBeInTheDocument()

    search(' a ')
    expect(screen.getByText('Nhập ít nhất 2 ký tự.')).toBeInTheDocument()
    expect(get).not.toHaveBeenCalled()
  })

  it('lists guest profiles with stats', async () => {
    const get = vi.spyOn(api, 'get').mockResolvedValue({ data: page() })
    renderPage()
    search('  ann ')

    expect(await screen.findByText('Ann Nguyễn')).toBeInTheDocument()
    expect(get).toHaveBeenCalledWith('/guests', { params: { q: 'ann', page: 1, limit: 20 } })
    const ann = screen.getByRole('listitem', { name: 'Ann Nguyễn' })
    expect(ann).toHaveTextContent('ann@example.test')
    expect(ann).toHaveTextContent('0900000003')
    expect(ann).toHaveTextContent('Có tài khoản')
    expect(ann).toHaveTextContent('3 booking · 1 lần đã trả phòng')
    expect(ann).toHaveTextContent('Nhận phòng gần nhất')
    const bob = screen.getByRole('listitem', { name: 'Bob Trần' })
    expect(bob).not.toHaveTextContent('Có tài khoản')
    expect(bob).toHaveTextContent('1 booking · 0 lần đã trả phòng')
    expect(bob).not.toHaveTextContent('Nhận phòng gần nhất')
  })

  it('links to create a booking for the guest and to view their bookings', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({ data: page() })
    renderPage()
    search('ann')
    await screen.findByText('Ann Nguyễn')

    const ann = screen.getByRole('listitem', { name: 'Ann Nguyễn' })
    const create = new URLSearchParams({
      guestName: 'Ann Nguyễn',
      guestEmail: 'ann@example.test',
      guestPhone: '0900000003',
    })
    expect(ann.querySelector('a[href^="/reception/booking/new"]')).toHaveAttribute(
      'href',
      `/reception/booking/new?${create.toString()}`,
    )
    expect(ann.querySelector('a[href^="/reception/bookings"]')).toHaveAttribute(
      'href',
      `/reception/bookings?${new URLSearchParams({ q: 'ann@example.test' }).toString()}`,
    )
  })

  it('pages through results', async () => {
    const get = vi.spyOn(api, 'get').mockResolvedValue({ data: page({ total: 45 }) })
    renderPage()
    search('ann')
    await screen.findByText('Ann Nguyễn')
    expect(screen.getByText('Trang 1 / 3 · 45 khách')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Trang trước' })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }))
    await waitFor(() =>
      expect(get).toHaveBeenLastCalledWith('/guests', { params: { q: 'ann', page: 2, limit: 20 } }),
    )
  })

  it('shows an empty state and an error state', async () => {
    vi.spyOn(api, 'get').mockResolvedValueOnce({ data: page({ items: [], total: 0 }) })
    const empty = renderPage()
    search('zzz')
    expect(await screen.findByText('Không tìm thấy khách nào phù hợp.')).toBeInTheDocument()
    empty.unmount()

    vi.spyOn(api, 'get').mockRejectedValue({
      isAxiosError: true,
      response: { status: 500, data: { message: 'Boom' } },
    })
    renderPage()
    search('ann')
    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })
})
