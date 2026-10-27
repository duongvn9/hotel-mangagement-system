import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { api } from '@/lib/api-client'
import { ME, renderWithAuth } from '@/features/auth/test-utils'
import { bookingRoutes } from './routes'
import type { BookingCharges, BookingListItem, SameDayList } from './api'
import { todayISO } from './utils'

const receptionist = { ...ME, id: 'u2', email: 'reception@hms.local', role: 'RECEPTIONIST' }

const row = (id: string, code: string, status: string, room: string): BookingListItem => ({
  id,
  code,
  status,
  guestName: `Khách ${code}`,
  guestEmail: `${code.toLowerCase()}@example.test`,
  guestPhone: '0900000001',
  rooms: [{ id: `room-${id}`, roomNumber: room, roomTypeName: 'Deluxe' }],
  checkIn: '2099-01-09T17:00:00.000Z',
  checkOut: '2099-01-11T17:00:00.000Z',
  guests: 2,
  roomTotal: 2_000_000,
  createdAt: '2099-01-01T00:00:00.000Z',
  walkIn: false,
})

const list = (): SameDayList => ({
  date: todayISO(),
  summary: {
    arrivals: { total: 0, awaitingDeposit: 0, ready: 0, checkedIn: 0 },
    departures: { total: 1, awaitingCheckOut: 1, checkedOut: 0 },
  },
  arrivals: [],
  departures: [row('d1', 'DPI', 'CHECKED_IN', '201')],
})

/** Hóa đơn: tổng 2.000.000, đã cọc 600.000; `paid` = đã thu nốt phần còn lại. */
const invoice = (paid: boolean): BookingCharges => ({
  bookingId: 'd1',
  code: 'DPI',
  status: 'CHECKED_IN',
  invoiceStatus: paid ? 'PAID' : 'PARTIALLY_PAID',
  totals: {
    roomTotal: 2_000_000,
    serviceTotal: 0,
    additionalTotal: 0,
    discountTotal: 0,
    taxTotal: 0,
    totalAmount: 2_000_000,
    depositPaid: 600_000,
    finalPaid: paid ? 1_400_000 : 0,
    balanceDue: paid ? 0 : 1_400_000,
  },
  charges: [],
})

function renderPage() {
  return renderWithAuth(bookingRoutes, {
    path: '/reception/front-desk',
    auth: { me: receptionist, status: 'authenticated' },
  })
}

function mockGet(initial: BookingCharges) {
  let current = initial
  const get = vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
    if (url === '/front-desk/same-day') return { data: list() }
    if (url === '/bookings/d1/charges') return { data: current }
    throw new Error(`unexpected GET ${url}`)
  })
  return {
    get,
    set: (next: BookingCharges) => {
      current = next
    },
  }
}

const departure = () => within(screen.getByRole('listitem', { name: 'DPI' }))

async function openPanel() {
  renderPage()
  await screen.findByRole('heading', { name: 'Khách đi (1)' })
  fireEvent.click(departure().getByRole('button', { name: 'Phụ phí' }))
  await departure().findByText(/Tổng cộng/)
}

const failure = (message: string) => ({
  isAxiosError: true,
  response: { status: 409, data: { message } },
})

describe('Pay and check out from the same-day departures list', () => {
  it('asks for payment first when money is still due', async () => {
    mockGet(invoice(false))
    await openPanel()

    expect(departure().getByRole('button', { name: 'Thu tiền mặt' })).toBeInTheDocument()
    expect(departure().getByRole('button', { name: 'Thanh toán VNPay' })).toBeInTheDocument()
    expect(departure().getByRole('button', { name: 'Check Out' })).toBeDisabled()
    expect(departure().getByText(/thanh toán đủ hóa đơn trước/i)).toBeInTheDocument()
  })

  it('confirms cash and refreshes the invoice, keeping the request id when it fails', async () => {
    const state = mockGet(invoice(false))
    const post = vi
      .spyOn(api, 'post')
      .mockRejectedValueOnce(failure('Boom'))
      .mockImplementation(async () => {
        state.set(invoice(true))
        return { data: {} }
      })
    await openPanel()

    fireEvent.click(departure().getByRole('button', { name: 'Thu tiền mặt' }))
    expect(departure().getByText(/Xác nhận đã thu 1\.400\.000/)).toBeInTheDocument()
    fireEvent.click(departure().getByRole('button', { name: 'Xác nhận đã thu tiền mặt' }))
    expect(await departure().findByRole('alert')).toBeInTheDocument()
    fireEvent.click(departure().getByRole('button', { name: 'Xác nhận đã thu tiền mặt' }))

    expect(await departure().findByText('Đã thanh toán đủ')).toBeInTheDocument()
    expect(post).toHaveBeenCalledTimes(2)
    const body = { requestId: expect.stringMatching(/^[A-Za-z0-9_-]{8,64}$/) }
    expect(post).toHaveBeenNthCalledWith(1, '/bookings/d1/payments/cash', body)
    expect(post.mock.calls[1]).toEqual(post.mock.calls[0])
    expect(departure().getByRole('button', { name: 'Check Out' })).toBeEnabled()
    expect(departure().queryByRole('button', { name: 'Thu tiền mặt' })).not.toBeInTheDocument()
  })

  it('can back out of the cash confirmation', async () => {
    mockGet(invoice(false))
    const post = vi.spyOn(api, 'post')
    await openPanel()
    fireEvent.click(departure().getByRole('button', { name: 'Thu tiền mặt' }))
    fireEvent.click(departure().getByRole('button', { name: 'Hủy' }))
    expect(departure().queryByText(/Xác nhận đã thu/)).not.toBeInTheDocument()
    expect(post).not.toHaveBeenCalled()
  })

  it('opens the VNPay page for the final payment and lets staff reload the invoice', async () => {
    const state = mockGet(invoice(false))
    const post = vi.spyOn(api, 'post').mockResolvedValue({
      data: { transactionRef: 'TXN-1', paymentUrl: 'https://vnpay.test/pay', amount: 1_400_000 },
    })
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    await openPanel()

    fireEvent.click(departure().getByRole('button', { name: 'Thanh toán VNPay' }))
    await waitFor(() => expect(post).toHaveBeenCalledWith('/payments/final', { bookingId: 'd1' }))
    await waitFor(() =>
      expect(open).toHaveBeenCalledWith('https://vnpay.test/pay', '_blank', 'noopener'),
    )
    expect(await departure().findByText(/Đã mở trang VNPay/)).toBeInTheDocument()

    state.set(invoice(true))
    fireEvent.click(departure().getByRole('button', { name: 'Tải lại' }))
    expect(await departure().findByText('Đã thanh toán đủ')).toBeInTheDocument()
  })

  it('shows the server error when VNPay cannot be started', async () => {
    mockGet(invoice(false))
    vi.spyOn(api, 'post').mockRejectedValue(failure('A pending payment already exists'))
    await openPanel()
    fireEvent.click(departure().getByRole('button', { name: 'Thanh toán VNPay' }))
    expect(await departure().findByRole('alert')).toHaveTextContent(
      'A pending payment already exists',
    )
  })

  it('checks the guest out after a confirmation and reloads the list', async () => {
    const state = mockGet(invoice(true))
    const post = vi.spyOn(api, 'post').mockResolvedValue({ data: {} })
    await openPanel()
    expect(departure().getByText('Đã thanh toán đủ')).toBeInTheDocument()
    expect(departure().queryByLabelText(/Số tiền/)).not.toBeInTheDocument()
    const before = state.get.mock.calls.length

    fireEvent.click(departure().getByRole('button', { name: 'Check Out' }))
    expect(departure().getByText(/Xác nhận Check Out phòng 201/)).toBeInTheDocument()
    expect(post).not.toHaveBeenCalled()
    fireEvent.click(departure().getByRole('button', { name: 'Xác nhận Check Out' }))

    await waitFor(() => expect(post).toHaveBeenCalledWith('/bookings/d1/check-out'))
    await waitFor(() => expect(state.get.mock.calls.length).toBeGreaterThan(before))
  })

  it('shows why a check-out was refused', async () => {
    mockGet(invoice(true))
    vi.spyOn(api, 'post').mockRejectedValue(failure('Invoice not fully paid: 100 VND still due'))
    await openPanel()
    fireEvent.click(departure().getByRole('button', { name: 'Check Out' }))
    fireEvent.click(departure().getByRole('button', { name: 'Xác nhận Check Out' }))
    expect(await departure().findByRole('alert')).toHaveTextContent('Invoice not fully paid')
  })
})
