import { screen } from '@testing-library/react'
import { api } from '@/lib/api-client'
import { ME, renderWithAuth } from '@/features/auth/test-utils'
import { bookingRoutes } from './routes'
import type { BookingCharges, BookingListItem, BookingListPage, InvoiceTotals } from './api'

const receptionist = { ...ME, id: 'u2', email: 'reception@hms.local', role: 'RECEPTIONIST' }

const totals = (overrides: Partial<InvoiceTotals> = {}): InvoiceTotals => ({
  roomTotal: 2_000_000,
  serviceTotal: 0,
  additionalTotal: 0,
  discountTotal: 0,
  taxTotal: 0,
  totalAmount: 2_000_000,
  depositPaid: 200_000,
  finalPaid: 0,
  balanceDue: 1_800_000,
  ...overrides,
})

const charges = (overrides: Partial<BookingCharges> = {}): BookingCharges => ({
  bookingId: 'b1',
  code: 'BKVIEW1',
  status: 'CONFIRMED',
  invoiceStatus: 'PARTIALLY_PAID',
  totals: totals(),
  charges: [],
  ...overrides,
})

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

function mockGet(items: BookingListItem[], invoice: BookingCharges = charges()) {
  return vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
    if (url === '/bookings') return { data: listPage(items) }
    if (url.endsWith('/charges')) return { data: invoice }
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

  it('shows the invoice: services, amount paid, balance due and status', async () => {
    mockGet(
      [item()],
      charges({
        invoiceStatus: 'PAID',
        totals: totals({
          serviceTotal: 500_000,
          totalAmount: 2_500_000,
          depositPaid: 200_000,
          finalPaid: 2_300_000,
          balanceDue: 0,
        }),
      }),
    )
    renderDetail()

    expect(await screen.findByText('Dịch vụ')).toBeInTheDocument()
    expect(screen.getByText('Còn phải trả')).toBeInTheDocument()
    expect(screen.getByText('Đã thanh toán đủ')).toBeInTheDocument()
    // Dòng "Đã thanh toán thêm" chỉ hiện khi có khoản trả cuối.
    expect(screen.getByText('Đã thanh toán thêm')).toBeInTheDocument()
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
