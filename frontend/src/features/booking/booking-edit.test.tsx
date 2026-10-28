import { fireEvent, screen, waitFor } from '@testing-library/react'
import { api } from '@/lib/api-client'
import { ME, renderWithAuth } from '@/features/auth/test-utils'
import { bookingRoutes } from './routes'
import type { AvailableRoom, BookingListItem, BookingListPage } from './api'
import { toBusinessDate } from './utils'

const receptionist = { ...ME, id: 'u2', email: 'reception@hms.local', role: 'RECEPTIONIST' }

const item = (overrides: Partial<BookingListItem> = {}): BookingListItem => ({
  id: 'b1',
  code: 'BKEDIT1',
  status: 'CONFIRMED',
  guestName: 'Nguyễn Văn A',
  guestEmail: 'a@example.test',
  guestPhone: '0900000001',
  rooms: [{ id: 'r1', roomNumber: '101', roomTypeName: 'Deluxe' }],
  checkIn: '2099-01-09T17:00:00.000Z', // 2099-01-10 giờ VN
  checkOut: '2099-01-11T17:00:00.000Z', // 2099-01-12 giờ VN
  adultCount: 2,
  childCount: 0,
  source: 'FRONT_DESK',
  roomTotal: 2_000_000,
  createdAt: '2099-01-01T00:00:00.000Z',
  walkIn: true,
  ...overrides,
})

const listPage = (items: BookingListItem[]): BookingListPage => ({
  items,
  total: items.length,
  page: 1,
  limit: 20,
})

const available: AvailableRoom[] = [
  { id: 'r2', roomTypeId: 't1', roomTypeName: 'Suite', pricePerNight: 2_000_000, capacity: 3 },
]

function mockGet(items: BookingListItem[]) {
  return vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
    if (url === '/bookings') return { data: listPage(items) }
    if (url === '/availability') return { data: available }
    throw new Error(`unexpected GET ${url}`)
  })
}

function renderEdit(role = receptionist, code = 'BKEDIT1') {
  return renderWithAuth(bookingRoutes, {
    path: `/reception/bookings/${code}/edit`,
    auth: { me: role, status: 'authenticated' },
  })
}

describe('toBusinessDate', () => {
  it('converts an instant to the Vietnam business day', () => {
    expect(toBusinessDate('2099-01-09T17:00:00.000Z')).toBe('2099-01-10')
    expect(toBusinessDate('2099-01-10T16:59:59.000Z')).toBe('2099-01-10')
    expect(toBusinessDate('2099-01-10')).toBe('2099-01-10')
  })
})

describe('EditBookingPage', () => {
  it('blocks roles other than receptionist/manager', () => {
    renderEdit({ ...receptionist, role: 'CUSTOMER' })
    expect(screen.getByText('Không có quyền truy cập')).toBeInTheDocument()
  })

  it('prefills the booking and saves the changes', async () => {
    const get = mockGet([item()])
    const patch = vi.spyOn(api, 'patch').mockResolvedValue({ data: { id: 'b1' } })
    renderEdit()

    expect(await screen.findByDisplayValue('Nguyễn Văn A')).toBeInTheDocument()
    expect(screen.getByLabelText(/Nhận phòng/)).toHaveValue('2099-01-10')
    expect(screen.getByLabelText(/Trả phòng/)).toHaveValue('2099-01-12')
    expect(screen.getByRole('checkbox', { name: /101 · Deluxe/ })).toBeChecked()
    expect(get).toHaveBeenCalledWith('/bookings', { params: { page: 1, limit: 20, q: 'BKEDIT1' } })

    expect(screen.getByLabelText(/Người lớn/)).toHaveValue(2)
    expect(screen.getByLabelText(/Trẻ em/)).toHaveValue(0)
    fireEvent.change(screen.getByLabelText(/Trẻ em/), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText(/Trả phòng/), { target: { value: '2099-01-13' } })
    fireEvent.click(await screen.findByRole('checkbox', { name: /Suite/ }))
    fireEvent.click(screen.getByRole('checkbox', { name: /101 · Deluxe/ }))
    fireEvent.change(screen.getByLabelText(/Họ tên/), { target: { value: ' Nguyễn Văn B ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))

    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith('/bookings/b1', {
        rooms: ['r2'],
        checkIn: '2099-01-10',
        checkOut: '2099-01-13',
        adultCount: 2,
        childCount: 1,
        guestName: 'Nguyễn Văn B',
        guestEmail: 'a@example.test',
        guestPhone: '0900000001',
      }),
    )
    // Lưu xong quay về danh sách booking.
    expect(await screen.findByRole('heading', { name: 'Danh sách booking' })).toBeInTheDocument()
  })

  it('needs at least one room', async () => {
    mockGet([item()])
    const patch = vi.spyOn(api, 'patch')
    renderEdit()
    await screen.findByDisplayValue('Nguyễn Văn A')
    fireEvent.click(screen.getByRole('checkbox', { name: /101 · Deluxe/ }))
    expect(screen.getByRole('button', { name: 'Lưu thay đổi' })).toBeDisabled()
    expect(patch).not.toHaveBeenCalled()
  })

  it('shows the server error when the rooms are taken and stays on the form', async () => {
    mockGet([item()])
    vi.spyOn(api, 'patch').mockRejectedValue({
      isAxiosError: true,
      response: { status: 409, data: { message: 'One or more rooms are not available' } },
    })
    renderEdit()
    await screen.findByDisplayValue('Nguyễn Văn A')
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Lưu thay đổi' })).toBeInTheDocument()
  })

  it('explains when the booking is missing or can no longer be edited', async () => {
    mockGet([])
    const missing = renderEdit()
    expect(await screen.findByText('Không tìm thấy booking này.')).toBeInTheDocument()
    missing.unmount()

    mockGet([item({ status: 'CANCELLED' })])
    renderEdit()
    expect(await screen.findByText(/không thể sửa/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Lưu thay đổi' })).not.toBeInTheDocument()
  })
})

describe('BookingListPage edit link', () => {
  it('shows an edit link only for pending or confirmed bookings', async () => {
    mockGet([
      item(),
      item({ id: 'b2', code: 'BKEDIT2', status: 'PENDING_DEPOSIT' }),
      item({ id: 'b3', code: 'BKEDIT3', status: 'CANCELLED' }),
      item({ id: 'b4', code: 'BKEDIT4', status: 'CHECKED_IN' }),
    ])
    renderWithAuth(bookingRoutes, {
      path: '/reception/bookings',
      auth: { me: receptionist, status: 'authenticated' },
    })
    await screen.findByText('BKEDIT1')
    const links = screen.getAllByRole('link', { name: 'Sửa' })
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/reception/bookings/BKEDIT1/edit',
      '/reception/bookings/BKEDIT2/edit',
    ])
  })
})
