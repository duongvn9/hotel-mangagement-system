import { screen } from '@testing-library/react'
import { api } from '@/lib/api-client'
import { ME, renderWithAuth } from '@/features/auth/test-utils'
import { bookingRoutes } from './routes'
import type { BookingListItem, BookingListPage } from './api'

const receptionist = { ...ME, id: 'u2', email: 'reception@hms.local', role: 'RECEPTIONIST' }

const item = (overrides: Partial<BookingListItem> = {}): BookingListItem => ({
  id: 'b1',
  code: 'BKVIEW1',
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

function mockGet(items: BookingListItem[]) {
  return vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
    if (url === '/bookings') return { data: listPage(items) }
    throw new Error(`unexpected GET ${url}`)
  })
}

function renderDetail(role = receptionist, code = 'BKVIEW1') {
  return renderWithAuth(bookingRoutes, {
    path: `/reception/bookings/${code}`,
    auth: { me: role, status: 'authenticated' },
  })
}

describe('ReceptionBookingDetailPage', () => {
  it('blocks roles other than receptionist/manager', () => {
    renderDetail({ ...receptionist, role: 'CUSTOMER' })
    expect(screen.getByText('Không có quyền truy cập')).toBeInTheDocument()
  })

  it('shows the booking details and an edit link for editable bookings', async () => {
    const get = mockGet([item()])
    renderDetail()

    expect(await screen.findByText('Nguyễn Văn A')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Chi tiết booking BKVIEW1' })).toBeInTheDocument()
    expect(screen.getByText('a@example.test')).toBeInTheDocument()
    expect(screen.getByText('0900000001')).toBeInTheDocument()
    expect(screen.getByText('101 · Deluxe')).toBeInTheDocument()
    expect(screen.getByText('2 đêm')).toBeInTheDocument()
    expect(get).toHaveBeenCalledWith('/bookings', { params: { page: 1, limit: 20, q: 'BKVIEW1' } })

    const edit = screen.getByRole('link', { name: 'Sửa booking' })
    expect(edit).toHaveAttribute('href', '/reception/bookings/BKVIEW1/edit')
  })

  it('hides the edit link for bookings that can no longer be edited', async () => {
    mockGet([item({ status: 'CHECKED_OUT' })])
    renderDetail()
    expect(await screen.findByText(/không còn sửa được/)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Sửa booking' })).not.toBeInTheDocument()
  })

  it('explains when the booking is not found', async () => {
    mockGet([])
    renderDetail()
    expect(await screen.findByText('Không tìm thấy booking')).toBeInTheDocument()
  })
})
