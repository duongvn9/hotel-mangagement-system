import { screen, within } from '@testing-library/react'
import { api } from '@/lib/api-client'
import { ME, renderWithAuth } from '@/features/auth/test-utils'
import { bookingRoutes } from './routes'
import type { BookingCharges, BookingListItem, BookingListPage } from './api'

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

/** Hóa đơn: phòng 2.000.000 + dịch vụ 430.000, đã cọc 200.000 và thu thêm 100.000. */
const invoice = (overrides: Partial<BookingCharges['totals']> = {}): BookingCharges => ({
  bookingId: 'b1',
  code: 'BKVIEW1',
  status: 'CONFIRMED',
  invoiceStatus: 'PARTIALLY_PAID',
  totals: {
    roomTotal: 2_000_000,
    serviceTotal: 430_000,
    additionalTotal: 0,
    discountTotal: 0,
    taxTotal: 0,
    totalAmount: 2_430_000,
    depositPaid: 200_000,
    finalPaid: 100_000,
    balanceDue: 2_130_000,
    ...overrides,
  },
  charges: [],
})

function mockGet(items: BookingListItem[], charges: BookingCharges = invoice()) {
  return vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
    if (url === '/bookings') return { data: listPage(items) }
    if (url === `/bookings/${items[0]?.id ?? 'b1'}/charges`) return { data: charges }
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

    expect(await screen.findByRole('heading', { level: 1, name: 'BKVIEW1' })).toBeInTheDocument()
    expect(screen.getByText('Nguyễn Văn A · Deluxe · Phòng 101')).toBeInTheDocument()
    expect(screen.getByText('Đã xác nhận')).toBeInTheDocument()
    expect(screen.getByText('Khách vãng lai')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Đặt phòng/ })).toHaveAttribute(
      'href',
      '/reception/bookings',
    )
    expect(screen.getByText('a@example.test')).toBeInTheDocument()
    expect(screen.getByText('0900000001')).toBeInTheDocument()
    expect(screen.getByText('Loại phòng')).toBeInTheDocument()
    expect(screen.getByText('Deluxe', { selector: 'span' })).toBeInTheDocument()
    expect(get).toHaveBeenCalledWith('/bookings', { params: { page: 1, limit: 20, q: 'BKVIEW1' } })

    const edit = screen.getByRole('link', { name: 'Sửa booking' })
    expect(edit).toHaveAttribute('href', '/reception/bookings/BKVIEW1/edit')
  })

  it('shows the invoice with the paid amount and what is left', async () => {
    mockGet([item()])
    renderDetail()

    const invoicePanel = (await screen.findByRole('heading', { name: 'Hoá đơn' })).closest(
      'section',
    ) as HTMLElement
    expect(within(invoicePanel).getByText('2.000.000 ₫')).toBeInTheDocument()
    expect(await within(invoicePanel).findByText('430.000 ₫')).toBeInTheDocument()
    expect(within(invoicePanel).getByText('200.000 ₫')).toBeInTheDocument()
    expect(within(invoicePanel).getByText('300.000 ₫')).toBeInTheDocument()
    expect(within(invoicePanel).getByText('2.130.000 ₫')).toBeInTheDocument()
  })

  it('still shows the room total when the invoice cannot be loaded', async () => {
    vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
      if (url === '/bookings') return { data: listPage([item()]) }
      throw new Error(`unexpected GET ${url}`)
    })
    renderDetail()

    const invoicePanel = (await screen.findByRole('heading', { name: 'Hoá đơn' })).closest(
      'section',
    ) as HTMLElement
    expect(within(invoicePanel).getByText('2.000.000 ₫')).toBeInTheDocument()
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
